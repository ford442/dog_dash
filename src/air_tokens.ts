import * as THREE from 'three';
import { time, vec3, color, uv, length, smoothstep, mix, sin, positionLocal } from 'three/tsl';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { decorationBudget } from './decoration_budget';

const BUDGET_ID = 'air_tokens';
const MAX_TOKENS = 32;
const COLLECT_RADIUS = 2.2;
const DEFAULT_LIFT = 18;

export type AirTokenPlacement = {
    x: number;
    y: number;
    z?: number;
    /** Upward speed granted on collect (flight-meter analogue). */
    lift?: number;
};

export type AirTokensEnvironmentConfig = {
    tokens: AirTokenPlacement[];
};

type TokenState = {
    x: number;
    y: number;
    z: number;
    lift: number;
    collected: boolean;
    bobOffset: number;
};

export class AirTokensSystem {
    scene: THREE.Scene;
    active: boolean = false;
    mesh: THREE.InstancedMesh;
    tokens: TokenState[] = [];
    private dummy = new THREE.Object3D();
    private registered = false;

    constructor(scene: THREE.Scene) {
        this.scene = scene;

        const geo = new THREE.OctahedronGeometry(0.7, 0);

        const mat = new MeshStandardNodeMaterial({
            roughness: 0.15,
            metalness: 0.55,
            transparent: true
        });

        const vUv = uv();
        const dist = length(vUv.sub(0.5));
        const core = smoothstep(0.45, 0.05, dist);
        const pulse = sin(time.mul(5.0)).mul(0.5).add(0.5);
        const mint = color(0x7fffd4);
        const gold = color(0xffe566);

        mat.colorNode = mix(mint, gold, core.mul(0.35));
        mat.emissiveNode = mix(mint, gold, pulse).mul(core.add(0.35)).mul(1.4);
        mat.positionNode = positionLocal.add(vec3(0, sin(time.mul(3.0)).mul(0.08), 0));

        this.mesh = new THREE.InstancedMesh(geo, mat, MAX_TOKENS);
        this.mesh.count = 0;
        this.mesh.frustumCulled = false;
        this.mesh.visible = false;
        this.scene.add(this.mesh);
        this.deactivate();
    }

    private ensureBudget(): void {
        if (this.registered) return;
        decorationBudget.register(BUDGET_ID, {
            label: 'Air tokens',
            category: 'effects',
            maxActive: MAX_TOKENS
        });
        this.registered = true;
    }

    activate(config?: AirTokensEnvironmentConfig) {
        if (this.active) return;
        this.active = true;
        this.ensureBudget();
        this.mesh.visible = true;

        const placements = config?.tokens ?? [];
        const count = Math.min(placements.length, MAX_TOKENS);
        this.tokens = [];

        for (let i = 0; i < count; i++) {
            const p = placements[i];
            this.tokens.push({
                x: p.x,
                y: p.y,
                z: p.z ?? 0,
                lift: p.lift ?? DEFAULT_LIFT,
                collected: false,
                bobOffset: i * 0.7
            });
        }

        this.mesh.count = this.tokens.length;
        this.writeMatrices(0);
        decorationBudget.syncCount(BUDGET_ID, this.tokens.length);
    }

    deactivate() {
        if (!this.active) return;
        this.active = false;
        this.mesh.visible = false;
        this.mesh.count = 0;
        this.tokens = [];
        decorationBudget.syncCount(BUDGET_ID, 0);
    }

    update(delta: number, _cameraX: number, _playerPos?: THREE.Vector3) {
        if (!this.active) return;
        this.writeMatrices(delta);
    }

    /** Collect the nearest uncollected token. Returns lift impulse, or null. */
    collectNear(playerPos: THREE.Vector3, radius: number = COLLECT_RADIUS): { lift: number } | null {
        if (!this.active) return null;

        const r2 = radius * radius;
        let best = -1;
        let bestDist = r2;

        for (let i = 0; i < this.tokens.length; i++) {
            const t = this.tokens[i];
            if (t.collected) continue;
            const dx = playerPos.x - t.x;
            const dy = playerPos.y - t.y;
            const dz = playerPos.z - t.z;
            const d2 = dx * dx + dy * dy + dz * dz;
            if (d2 <= bestDist) {
                bestDist = d2;
                best = i;
            }
        }

        if (best < 0) return null;

        const token = this.tokens[best];
        token.collected = true;
        this.writeMatrices(0);
        decorationBudget.syncCount(BUDGET_ID, this.tokens.filter((t) => !t.collected).length);
        return { lift: token.lift };
    }

    cleanup() {
        this.deactivate();
        this.scene.remove(this.mesh);
        this.mesh.geometry.dispose();
        (this.mesh.material as THREE.Material).dispose();
    }

    private writeMatrices(delta: number) {
        const now = performance.now() * 0.001;
        for (let i = 0; i < this.tokens.length; i++) {
            const t = this.tokens[i];
            if (t.collected) {
                this.dummy.position.set(t.x, t.y, t.z);
                this.dummy.scale.set(0, 0, 0);
            } else {
                const bob = Math.sin(now * 2.4 + t.bobOffset) * 0.35;
                this.dummy.position.set(t.x, t.y + bob, t.z);
                this.dummy.rotation.y += delta * 2.2;
                this.dummy.scale.set(1, 1, 1);
            }
            this.dummy.updateMatrix();
            this.mesh.setMatrixAt(i, this.dummy.matrix);
        }
        if (this.tokens.length > 0) {
            this.mesh.instanceMatrix.needsUpdate = true;
        }
    }
}
