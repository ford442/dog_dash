/**
 * gpu_integrate/webgpu_kernel.ts
 * WebGPU implementation of {@link IntegrateKernel}.
 *
 * Hard rules:
 *  1. Never calls `requestAdapter()` / `requestDevice()`. It is handed the
 *     device the boot probe created (via the renderer), or nothing.
 *  2. Readback is cosmetic. Matrices land a frame or more late and are only
 *     ever copied into an InstancedMesh. Nothing here writes SpatialIndex,
 *     collision, harvest or any other gameplay state.
 *  3. Any error — pipeline creation, validation, a rejected `mapAsync`, a lost
 *     device — sets `failed`; the owning system drops back to the JS integrate.
 */

import { integrateWgsl, WORKGROUP_SIZE } from './kernels';
import {
    MATRIX_FLOATS,
    PARTICLE_GRAVITY,
    READBACK_RING,
    SLOT_WORDS,
    stateFloats,
    type IntegrateKernel,
    type IntegrateKind,
    type IntegrateResult
} from './types';

type Staging = { buffer: GPUBuffer; busy: boolean };

export async function createWebGpuIntegrateKernel(
    device: GPUDevice,
    kind: IntegrateKind,
    capacity: number
): Promise<IntegrateKernel> {
    const label = `gpu-integrate-${kind}`;
    const stride = stateFloats(kind);

    const module = device.createShaderModule({ code: integrateWgsl(kind), label });
    const storage = (type: GPUBufferBindingType): GPUBindGroupLayoutEntry['buffer'] => ({ type });
    const bindGroupLayout = device.createBindGroupLayout({
        label,
        entries: [
            { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: storage('uniform') },
            { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: storage('read-only-storage') },
            { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: storage('storage') },
            { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: storage('read-only-storage') },
            { binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: storage('read-only-storage') },
            { binding: 5, visibility: GPUShaderStage.COMPUTE, buffer: storage('storage') }
        ]
    });
    const layout = device.createPipelineLayout({ label, bindGroupLayouts: [bindGroupLayout] });

    // Async creation rejects on a WGSL/validation error instead of surfacing it
    // later as an uncaptured error.
    const [integratePipeline, composePipeline] = await Promise.all([
        device.createComputePipelineAsync({ label: `${label}-integrate`, layout, compute: { module, entryPoint: 'integrate' } }),
        device.createComputePipelineAsync({ label: `${label}-compose`, layout, compute: { module, entryPoint: 'compose' } })
    ]);

    const buffer = (name: string, size: number, usage: GPUBufferUsageFlags) =>
        device.createBuffer({ label: `${label}-${name}`, size: Math.max(16, size), usage });

    const STORAGE_DST = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST;
    const stateBytes = capacity * stride * 4;
    const matrixBytes = capacity * MATRIX_FLOATS * 4;
    const states = [buffer('state-a', stateBytes, STORAGE_DST), buffer('state-b', stateBytes, STORAGE_DST)];
    const params = buffer('params', 16, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);
    const permBuffer = buffer('perm', capacity * 4, STORAGE_DST);
    const slotBuffer = buffer('slots', capacity * SLOT_WORDS * 4, STORAGE_DST);
    const matrixBuffer = buffer('matrices', matrixBytes, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC);
    const staging: Staging[] = Array.from({ length: READBACK_RING }, (_, i) => ({
        buffer: buffer(`readback-${i}`, matrixBytes, GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST),
        busy: false
    }));

    const bindGroups = [0, 1].map((from) => device.createBindGroup({
        label: `${label}-${from ? 'b-to-a' : 'a-to-b'}`,
        layout: bindGroupLayout,
        entries: [
            { binding: 0, resource: { buffer: params } },
            { binding: 1, resource: { buffer: states[from]! } },
            { binding: 2, resource: { buffer: states[from ^ 1]! } },
            { binding: 3, resource: { buffer: permBuffer } },
            { binding: 4, resource: { buffer: slotBuffer } },
            { binding: 5, resource: { buffer: matrixBuffer } }
        ]
    }));

    const paramsData = new ArrayBuffer(16);
    const paramsU32 = new Uint32Array(paramsData);
    const paramsF32 = new Float32Array(paramsData);

    let cur = 0;
    let seq = 0;
    let latest: IntegrateResult | null = null;
    /** Newest seq ever published — readbacks can resolve out of order. */
    let newestPublished = 0;
    let failed: string | null = null;
    let disposed = false;
    const inFlight = new Set<Promise<void>>();

    const fail = (reason: string) => {
        if (failed) return;
        failed = reason;
        console.warn(`[gpu-integrate] ${kind} kernel failed: ${reason}`);
    };

    return {
        id: 'webgpu',
        kind,
        capacity,
        get failed() { return failed; },

        writeState(start, data, n) {
            if (failed || disposed || n <= 0) return;
            device.queue.writeBuffer(states[cur]!, start * stride * 4, data, 0, n * stride);
        },

        step(count, delta, perm, slots, kept) {
            if (failed || disposed) return -1;
            seq++;
            const mySeq = seq;

            paramsU32[0] = count;
            paramsU32[1] = kept;
            paramsF32[2] = delta;
            paramsF32[3] = PARTICLE_GRAVITY;
            device.queue.writeBuffer(params, 0, paramsData);
            if (count > 0) device.queue.writeBuffer(permBuffer, 0, perm, 0, count);
            if (kept > 0) device.queue.writeBuffer(slotBuffer, 0, slots, 0, kept * SLOT_WORDS);

            device.pushErrorScope('validation');
            const encoder = device.createCommandEncoder({ label });
            const pass = encoder.beginComputePass({ label });
            pass.setBindGroup(0, bindGroups[cur]!);
            if (count > 0) {
                pass.setPipeline(integratePipeline);
                pass.dispatchWorkgroups(Math.ceil(count / WORKGROUP_SIZE));
            }
            if (kept > 0) {
                pass.setPipeline(composePipeline);
                pass.dispatchWorkgroups(Math.ceil(kept / WORKGROUP_SIZE));
            }
            pass.end();

            // Nothing to draw: publish an empty result now, so a stale readback
            // that lands later (smaller seq) cannot resurrect old instances.
            let ticket = -1;
            let target: Staging | null = null;
            if (kept === 0) {
                newestPublished = mySeq;
                latest = { seq: mySeq, ticket: -1, kept: 0, matrices: new Float32Array(0) };
            } else {
                const free = staging.findIndex(s => !s.busy);
                if (free >= 0) {
                    ticket = free;
                    target = staging[free]!;
                    target.busy = true;
                    encoder.copyBufferToBuffer(matrixBuffer, 0, target.buffer, 0, kept * MATRIX_FLOATS * 4);
                }
                // No free slot: the sim still advanced; the mesh keeps its
                // last-good matrices until a readback slot frees up.
            }

            device.queue.submit([encoder.finish()]);
            void device.popErrorScope().then((error) => {
                if (error) fail(`validation: ${error.message}`);
            }, (error) => fail(`popErrorScope: ${(error as Error)?.message ?? error}`));

            cur ^= 1;

            if (target) {
                const stagingSlot = target;
                const bytes = kept * MATRIX_FLOATS * 4;
                const job = stagingSlot.buffer.mapAsync(GPUMapMode.READ, 0, bytes)
                    .then(() => {
                        if (disposed) return;
                        const matrices = new Float32Array(stagingSlot.buffer.getMappedRange(0, bytes).slice(0));
                        stagingSlot.buffer.unmap();
                        if (mySeq > newestPublished) {
                            newestPublished = mySeq;
                            latest = { seq: mySeq, ticket, kept, matrices };
                        }
                    })
                    .catch((error) => {
                        if (!disposed) fail(`mapAsync: ${(error as Error)?.message ?? error}`);
                    })
                    .finally(() => {
                        stagingSlot.busy = false;
                        inFlight.delete(job);
                    });
                inFlight.add(job);
            }
            return ticket;
        },

        takeLatest() {
            const result = latest;
            latest = null;
            return result;
        },

        fail,

        async settled() {
            await device.queue.onSubmittedWorkDone();
            while (inFlight.size > 0) {
                await Promise.all([...inFlight]);
            }
        },

        dispose() {
            if (disposed) return;
            disposed = true;
            for (const b of [...states, params, permBuffer, slotBuffer, matrixBuffer, ...staging.map(s => s.buffer)]) {
                try { b.destroy(); } catch { /* lost device: already gone */ }
            }
        }
    };
}
