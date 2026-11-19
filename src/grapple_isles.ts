import * as THREE from 'three';
import { vec3, color, uniform, float, sin, smoothstep, length, positionWorld, positionLocal, vertexColor, attribute, instanceIndex, clamp, abs } from 'three/tsl';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { decorationBudget } from './decoration_budget';
import { getIsleGeometry } from './scenery_art/isles';

/**
 * Isle material: vertex colours from the merged island, a lantern that
 * flickers warm, and a hook ring + cyan wash that light up as the player
 * approaches (the "grapple point" tell). `uTime` / `uPlayerPos` are uniforms
 * so the gallery can pose it.
 */
export function createIsleMaterial(
    uTime: ReturnType<typeof uniform>,
    uPlayerPos: ReturnType<typeof uniform>,
    opts: { foreground?: boolean } = {}
): MeshStandardNodeMaterial {
    const fg = !!opts.foreground;
    const mat = new MeshStandardNodeMaterial({
        roughness: 0.9,
        metalness: 0.1,
        transparent: fg, // Only foreground might obscure player
        depthWrite: !fg,
        side: fg ? THREE.DoubleSide : THREE.FrontSide
    });

    // Gentle bob in local units (the instance scale turns it into ~0.2–0.8 world units).
    const phase = float(instanceIndex).mul(1.7);
    mat.positionNode = positionLocal.add(vec3(0, sin(uTime.mul(0.8).add(phase)).mul(0.05), 0));

    const mask = attribute('aMask', 'float');
    const lantern = clamp(float(1).sub(abs(mask.sub(1))), 0, 1);
    const ring = clamp(mask.sub(1), 0, 1);

    const distToPlayer = length(positionWorld.sub(uPlayerPos));
    const near = smoothstep(40.0, 10.0, distToPlayer);

    mat.colorNode = vertexColor().add(color(0x00ffcc).mul(near.mul(0.25)));
    const flicker = sin(uTime.mul(7.0).add(phase)).mul(0.1).add(0.9);
    mat.emissiveNode = color(0xffb84a).mul(lantern.mul(flicker).mul(1.4))
        .add(color(0x66ffee).mul(ring.mul(near.mul(1.6).add(0.15))));
    return mat;
}

export class GrappleIslesSystem {
    scene: THREE.Scene;
    active: boolean = false;

    private layerMeshes: THREE.InstancedMesh[] = [];
    private layerParams: { speed: number; z: number; width: number; count: number }[] = [];
    private uPlayerPos = uniform(vec3(0, 0, 0));
    private timeUniform = uniform(0.0);

    constructor(scene: THREE.Scene) {
        this.scene = scene;

        decorationBudget.register('grapple_isles', {
            label: 'Grapple isles (4 parallax layers)',
            category: 'background3d',
            maxActive: 50 // fixed 20+15+10+5 across the 4 layer InstancedMeshes
        });

        // Floating island (grass top, rocky underside, roots, tree, lantern, hook ring): one shared merged geometry.
        const geo = getIsleGeometry();

        // Setup multiple parallax layers
        this.layerParams = [
            { speed: 0.1, z: -80, width: 400, count: 20 },  // Deep background
            { speed: 0.25, z: -40, width: 300, count: 15 }, // Midground
            { speed: 0.5, z: -15, width: 250, count: 10 },  // Near midground
            { speed: 0.8, z: 5, width: 200, count: 5 }      // Foreground (passes in front)
        ];

        for (let i = 0; i < this.layerParams.length; i++) {
            const params = this.layerParams[i];

            // Unique material per layer (the foreground layer is see-through-capable)
            const mat = createIsleMaterial(this.timeUniform, this.uPlayerPos, { foreground: i === 3 });
            const mesh = new THREE.InstancedMesh(geo, mat, params.count);
            mesh.frustumCulled = false;

            const dummy = new THREE.Object3D();
            for (let j = 0; j < params.count; j++) {
                const x = (Math.random() - 0.5) * params.width; // visual-only
                const y = (Math.random() - 0.5) * 40; // visual-only

                // Random scale
                const s = 4 + Math.random() * 8 + (i * 2); // visual-only; Foreground islands are larger
                dummy.position.set(x, y, params.z);

                // Upright (grass up), turned about Y, with a slight drift tilt
                dummy.rotation.set(
                    (Math.random() - 0.5) * 0.2, // visual-only
                    (Math.random() - 0.5) * 1.6, // visual-only; keep the hook ring roughly toward the camera
                    (Math.random() - 0.5) * 0.2 // visual-only
                );

                dummy.scale.set(s, s * (0.85 + Math.random() * 0.3), s); // visual-only
                dummy.updateMatrix();
                mesh.setMatrixAt(j, dummy.matrix);
            }

            mesh.instanceMatrix.needsUpdate = true;
            this.layerMeshes.push(mesh);
            this.scene.add(mesh);
        }

        this.deactivate();
    }

    activate(config?: { density?: number }) {
        if (this.active) return;
        this.active = true;
        this.layerMeshes.forEach(m => m.visible = true);
        const total = this.layerMeshes.reduce((sum, m) => sum + m.count, 0);
        decorationBudget.syncCount('grapple_isles', total);
    }

    deactivate() {
        if (!this.active) return;
        this.active = false;
        this.layerMeshes.forEach(m => m.visible = false);
        decorationBudget.syncCount('grapple_isles', 0);
    }

    update(delta: number, cameraX: number, playerPos?: THREE.Vector3) {
        if (!this.active) return;

        this.timeUniform.value += delta;
        if (playerPos) {
            this.uPlayerPos.value.copy(playerPos);
        }

        // Parallax scroll logic
        const margin = 50;
        for (let i = 0; i < this.layerParams.length; i++) {
            const params = this.layerParams[i];
            const mesh = this.layerMeshes[i];

            // Base offset driven by cameraX to create parallax
            // We want slower layers to move LESS with the camera
            const scrollX = cameraX * params.speed;

            // Actually move the mesh wrapper so instances wrap around it
            mesh.position.x = scrollX;

            const limitBack = cameraX - (params.width / 2) - margin - scrollX;
            const limitFront = cameraX + (params.width / 2) + margin - scrollX;

            let needsUpdate = false;
            const dummy = new THREE.Object3D();
            const pos = new THREE.Vector3();
            const quat = new THREE.Quaternion();
            const scale = new THREE.Vector3();

            for (let j = 0; j < params.count; j++) {
                mesh.getMatrixAt(j, dummy.matrix);
                dummy.matrix.decompose(pos, quat, scale);

                let wrapped = false;
                if (pos.x < limitBack) {
                    pos.x += params.width + margin * 2;
                    wrapped = true;
                } else if (pos.x > limitFront) {
                    pos.x -= params.width + margin * 2;
                    wrapped = true;
                }

                if (wrapped) {
                    dummy.position.copy(pos);
                    dummy.quaternion.copy(quat);
                    dummy.scale.copy(scale);
                    dummy.updateMatrix();
                    mesh.setMatrixAt(j, dummy.matrix);
                    needsUpdate = true;
                }
            }
            if (needsUpdate) {
                mesh.instanceMatrix.needsUpdate = true;
            }
        }
    }

    /**
     * Level-start reset (LevelManager.disposeLevelStreamingResources runs it
     * right after the env plugins activate). The four layer meshes are a
     * fixed pool built once and reused by every activation, so they stay:
     * disposing them here left `update()` indexing an empty pool while active.
     */
    cleanup() {
        const total = this.active ? this.layerMeshes.reduce((sum, m) => sum + m.count, 0) : 0;
        decorationBudget.syncCount('grapple_isles', total);
    }
}
