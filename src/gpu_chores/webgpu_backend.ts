/**
 * gpu_chores/webgpu_backend.ts
 * Optional WebGPU tier for *cosmetic* reductions.
 *
 * Hard rules this file exists to enforce:
 *
 *  1. It NEVER calls `navigator.gpu.requestAdapter()` / `requestDevice()`.
 *     It only adopts the device the Three.js `WebGPURenderer` already created.
 *     If renderer boot failed, there is no device and this tier stays off —
 *     chores must not resurrect a GPU that the boot probe rejected.
 *  2. It NEVER owns particle state. It reads a snapshot copy of values JS
 *     already computed and returns a scalar. There is no writeback, so GL and
 *     WebGPU can never both be hot on the same SoA.
 *  3. Results are async and may be a frame or more late — cosmetic readouts
 *     only (HUD meters, juice intensity, debug counters).
 */

import type { AsyncChoresBackend, ReduceOp } from './types';

const WORKGROUP_SIZE = 64;

const REDUCE_OP_CODE: Record<ReduceOp, number> = { sum: 0, max: 1, min: 2 };

const REDUCE_WGSL = /* wgsl */ `
struct Params {
    count: u32,
    op: u32,
    _pad0: u32,
    _pad1: u32,
};

@group(0) @binding(0) var<storage, read> src: array<f32>;
@group(0) @binding(1) var<storage, read_write> partials: array<f32>;
@group(0) @binding(2) var<uniform> params: Params;

var<workgroup> scratch: array<f32, ${WORKGROUP_SIZE}>;

fn identity(op: u32) -> f32 {
    if (op == 1u) { return -3.4028235e38; }
    if (op == 2u) { return 3.4028235e38; }
    return 0.0;
}

fn combine(op: u32, a: f32, b: f32) -> f32 {
    if (op == 1u) { return max(a, b); }
    if (op == 2u) { return min(a, b); }
    return a + b;
}

@compute @workgroup_size(${WORKGROUP_SIZE})
fn main(
    @builtin(global_invocation_id) gid: vec3<u32>,
    @builtin(local_invocation_id) lid: vec3<u32>,
    @builtin(workgroup_id) wid: vec3<u32>
) {
    let op = params.op;
    var value = identity(op);
    if (gid.x < params.count) {
        value = src[gid.x];
    }
    scratch[lid.x] = value;
    workgroupBarrier();

    var stride = ${WORKGROUP_SIZE}u >> 1u;
    loop {
        if (stride == 0u) { break; }
        if (lid.x < stride) {
            scratch[lid.x] = combine(op, scratch[lid.x], scratch[lid.x + stride]);
        }
        workgroupBarrier();
        stride = stride >> 1u;
    }

    if (lid.x == 0u) {
        partials[wid.x] = scratch[0];
    }
}
`;

/** Minimal shape of the Three.js WebGPU renderer we are willing to poke at. */
type DeviceHost = { backend?: { device?: GPUDevice | null } | null } | null | undefined;

/**
 * Returns the renderer's existing `GPUDevice`, or null. Never requests one.
 */
export function adoptRendererDevice(renderer: unknown): GPUDevice | null {
    const host = renderer as DeviceHost;
    const device = host?.backend?.device;
    return device ?? null;
}

export function createWebGpuChoresBackend(device: GPUDevice): AsyncChoresBackend {
    const module = device.createShaderModule({ code: REDUCE_WGSL, label: 'gpu-chores-reduce' });
    const pipeline = device.createComputePipeline({
        label: 'gpu-chores-reduce',
        layout: 'auto',
        compute: { module, entryPoint: 'main' }
    });

    const paramsBuffer = device.createBuffer({
        label: 'gpu-chores-params',
        size: 16,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    const paramsData = new Uint32Array(4);

    let capacity = 0;
    let srcBuffer: GPUBuffer | null = null;
    let partialsBuffer: GPUBuffer | null = null;
    let readbackBuffer: GPUBuffer | null = null;
    let bindGroup: GPUBindGroup | null = null;
    let disposed = false;
    /** Serialises submissions so a readback is never mapped twice at once. */
    let queue: Promise<unknown> = Promise.resolve();

    function ensureCapacity(count: number): void {
        if (srcBuffer && count <= capacity) return;

        srcBuffer?.destroy();
        partialsBuffer?.destroy();
        readbackBuffer?.destroy();

        capacity = Math.max(WORKGROUP_SIZE, 1 << Math.ceil(Math.log2(Math.max(count, 1))));
        const groups = Math.ceil(capacity / WORKGROUP_SIZE);

        srcBuffer = device.createBuffer({
            label: 'gpu-chores-src',
            size: capacity * 4,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        });
        partialsBuffer = device.createBuffer({
            label: 'gpu-chores-partials',
            size: groups * 4,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
        });
        readbackBuffer = device.createBuffer({
            label: 'gpu-chores-readback',
            size: groups * 4,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        });
        bindGroup = device.createBindGroup({
            label: 'gpu-chores-bind',
            layout: pipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: srcBuffer } },
                { binding: 1, resource: { buffer: partialsBuffer } },
                { binding: 2, resource: { buffer: paramsBuffer } }
            ]
        });
    }

    function foldPartials(partials: Float32Array, groups: number, op: ReduceOp): number {
        let acc = partials[0];
        for (let i = 1; i < groups; i++) {
            const value = partials[i];
            if (op === 'sum') acc += value;
            else if (op === 'max') acc = Math.max(acc, value);
            else acc = Math.min(acc, value);
        }
        return acc;
    }

    async function dispatch(values: Float32Array, count: number, op: ReduceOp): Promise<number> {
        ensureCapacity(count);
        const groups = Math.ceil(count / WORKGROUP_SIZE);

        // Byte-offset form: `values` may be a subarray view over a larger SoA.
        device.queue.writeBuffer(srcBuffer!, 0, values.buffer as ArrayBuffer, values.byteOffset, count * 4);
        paramsData[0] = count;
        paramsData[1] = REDUCE_OP_CODE[op];
        device.queue.writeBuffer(paramsBuffer, 0, paramsData.buffer as ArrayBuffer, 0, paramsData.byteLength);

        const encoder = device.createCommandEncoder({ label: 'gpu-chores-reduce' });
        const pass = encoder.beginComputePass({ label: 'gpu-chores-reduce' });
        pass.setPipeline(pipeline);
        pass.setBindGroup(0, bindGroup!);
        pass.dispatchWorkgroups(groups);
        pass.end();
        encoder.copyBufferToBuffer(partialsBuffer!, 0, readbackBuffer!, 0, groups * 4);
        device.queue.submit([encoder.finish()]);

        await readbackBuffer!.mapAsync(GPUMapMode.READ, 0, groups * 4);
        const partials = new Float32Array(readbackBuffer!.getMappedRange(0, groups * 4).slice(0));
        readbackBuffer!.unmap();

        return foldPartials(partials, groups, op);
    }

    return {
        id: 'webgpu',

        reduceAsync(values: Float32Array, count: number, op: ReduceOp): Promise<number> {
            const limit = Math.min(count, values.length);
            if (disposed || limit <= 0) return Promise.resolve(0);

            const run = queue.then(() => dispatch(values, limit, op));
            // Keep the chain alive even when a caller drops a rejected promise.
            queue = run.catch(() => undefined);
            return run;
        },

        dispose(): void {
            disposed = true;
            srcBuffer?.destroy();
            partialsBuffer?.destroy();
            readbackBuffer?.destroy();
            paramsBuffer.destroy();
            srcBuffer = null;
            partialsBuffer = null;
            readbackBuffer = null;
            bindGroup = null;
            capacity = 0;
        }
    };
}
