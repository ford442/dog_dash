/**
 * Vacuum Kelp — energy-draining strands with harvestable nodes.
 *
 * Verlet rope (5–8 nodes) through the shared `verletBodyPool` / AS
 * `stepPhysics`. When WASM physics is missing, the TSL membrane keeps the
 * shader-sway visual (same contract as Jelly-Moss).
 */

import * as THREE from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { color, time, positionLocal, sin, cos, mix, vec3, float } from 'three/tsl';
import { verletBodyPool } from '../verlet_body_pool';
import {
    KELP_CONTACT_RADIUS,
    KELP_NODE_HP,
    pickKelpConfig,
    kelpDrainPerSec,
    kelpSpeedMultiplier,
    type KelpConfig
} from './flora_gameplay';

const SPRING_SEGMENT = 90;
const SPRING_PIN = 140;
const DAMPING = 8;
const MAX_STRANDS = 8;

export type VacuumKelpNodeState = {
    mesh: THREE.Mesh;
    hp: number;
    alive: boolean;
    restY: number;
};

type KelpSlot = {
    group: THREE.Group;
    nodes: VacuumKelpNodeState[];
    bodyStart: number;
    bodyCount: number;
    restX: Float32Array;
    restY: Float32Array;
    nodeSpacing: number;
};

function createKelpMembraneMaterial(): MeshStandardNodeMaterial {
    const mat = new MeshStandardNodeMaterial({
        color: 0x1aa8ff,
        roughness: 0.35,
        metalness: 0.15,
        transparent: true,
        opacity: 0.82,
        side: THREE.DoubleSide
    });
    const pos = positionLocal;
    const t = time;
    const wobble = sin(pos.y.mul(3.2).add(t.mul(1.6)))
        .add(cos(pos.x.mul(2.4).add(t.mul(1.1))));
    mat.positionNode = pos.add(vec3(wobble.mul(0.08), float(0.0), wobble.mul(0.05)));
    const pulse = sin(t.mul(2.2)).mul(0.5).add(0.5);
    mat.emissiveNode = mix(color(0x003366), color(0x44ddff), pulse);
    return mat;
}

export function createVacuumKelp(config: { length: number; nodes: number }): THREE.Group {
    const group = new THREE.Group();
    const nodeHeight = config.length / Math.max(1, config.nodes);
    const geo = new THREE.CapsuleGeometry(0.45, Math.max(0.4, nodeHeight - 0.45), 4, 8);
    const material = createKelpMembraneMaterial();
    const nodes: VacuumKelpNodeState[] = [];

    for (let i = 0; i < config.nodes; i++) {
        const mesh = new THREE.Mesh(geo, material);
        mesh.position.y = i * nodeHeight;
        mesh.userData.idx = i;
        mesh.userData.baseY = mesh.position.y;
        group.add(mesh);
        nodes.push({ mesh, hp: KELP_NODE_HP, alive: true, restY: mesh.position.y });
    }

    group.userData = {
        type: 'vacuumKelp',
        speciesId: 'vacuumKelp',
        nodes: config.nodes,
        nodeStates: nodes,
        nodeSpacing: nodeHeight,
        length: config.length,
        usingVerlet: false
    };

    return group;
}

export function updateVacuumKelp(group: THREE.Group, _delta: number, timeVal: number): void {
    if (group.userData.usingVerlet) return;
    const swaySpeed = 2.0;
    const swayAmp = 0.2;
    group.children.forEach((child, i) => {
        if (!(child as THREE.Mesh).isMesh) return;
        if (child.userData.severed) return;
        const angle = Math.sin(timeVal * swaySpeed + i * 0.5) * swayAmp * (i + 1) * 0.1;
        child.position.x = Math.sin(angle) * (i * 2);
        child.rotation.z = angle;
        child.position.y = (child.userData.baseY as number) ?? child.position.y;
    });
}

export class VacuumKelpSoftBody {
    private slots: KelpSlot[] = [];
    private registered = false;
    private pending: THREE.Group[] = [];

    get usingVerlet(): boolean {
        return verletBodyPool.isReady && this.slots.length > 0;
    }

    constructor() {
        this.ensureRegistered();
    }

    tryAttach(group: THREE.Group): boolean {
        this.ensureRegistered();
        if (!verletBodyPool.isReady) {
            if (!this.pending.includes(group) && this.pending.length < MAX_STRANDS) {
                this.pending.push(group);
            }
            group.userData.usingVerlet = false;
            return false;
        }
        this.pending = this.pending.filter((g) => g !== group);
        if (this.slots.some((s) => s.group === group)) {
            group.userData.usingVerlet = true;
            return true;
        }
        if (this.slots.length >= MAX_STRANDS) return false;

        const nodeStates = group.userData.nodeStates as VacuumKelpNodeState[] | undefined;
        if (!nodeStates || nodeStates.length < 2) return false;

        const bodyCount = nodeStates.length;
        const restX = new Float32Array(bodyCount);
        const restY = new Float32Array(bodyCount);
        for (let i = 0; i < bodyCount; i++) {
            restX[i] = 0;
            restY[i] = nodeStates[i]!.restY;
        }

        this.slots.push({
            group,
            nodes: nodeStates,
            bodyStart: 0,
            bodyCount,
            restX,
            restY,
            nodeSpacing: (group.userData.nodeSpacing as number) || 2.8
        });
        group.userData.usingVerlet = true;
        verletBodyPool.relayout();
        return true;
    }

    detach(group: THREE.Group): void {
        this.pending = this.pending.filter((g) => g !== group);
        const idx = this.slots.findIndex((s) => s.group === group);
        if (idx < 0) return;
        group.userData.usingVerlet = false;
        this.slots.splice(idx, 1);
        verletBodyPool.relayout();
    }

    applyForces(): void {
        if (!verletBodyPool.isReady || this.slots.length === 0) return;
        const exports = verletBodyPool.exports;
        if (!exports) return;

        for (const slot of this.slots) {
            for (let i = 0; i < slot.bodyCount; i++) {
                const idx = slot.bodyStart + i;
                if (!slot.nodes[i]?.alive) continue;
                const x = exports.getBodyPositionX!(idx);
                const y = exports.getBodyPositionY!(idx);

                let ax = 0;
                let ay = 0;
                if (i === 0) {
                    ax += (slot.restX[i] - x) * SPRING_PIN;
                    ay += (slot.restY[i] - y) * SPRING_PIN;
                } else {
                    const prev = slot.bodyStart + i - 1;
                    const px = exports.getBodyPositionX!(prev);
                    const py = exports.getBodyPositionY!(prev);
                    const dx = x - px;
                    const dy = y - py;
                    const dist = Math.hypot(dx, dy) || 0.0001;
                    const stretch = dist - slot.nodeSpacing;
                    const fx = (dx / dist) * stretch * SPRING_SEGMENT;
                    const fy = (dy / dist) * stretch * SPRING_SEGMENT;
                    ax -= fx;
                    ay -= fy;
                    exports.addBodyAcceleration!(prev, fx, fy);
                    ax += (slot.restX[i] - x) * 6;
                    ay += (slot.restY[i] - y) * 4;
                }
                ax += (slot.restX[i] - x) * DAMPING * 0.15;
                ay += (slot.restY[i] - y) * DAMPING * 0.15;
                exports.addBodyAcceleration!(idx, ax, ay);
            }
        }
    }

    syncVisuals(): void {
        if (!verletBodyPool.isReady || this.slots.length === 0) return;
        const exports = verletBodyPool.exports;
        if (!exports) return;

        for (const slot of this.slots) {
            for (let i = 0; i < slot.bodyCount; i++) {
                const node = slot.nodes[i];
                if (!node?.alive) continue;
                const idx = slot.bodyStart + i;
                node.mesh.position.x = exports.getBodyPositionX!(idx);
                node.mesh.position.y = exports.getBodyPositionY!(idx);
                if (i > 0) {
                    const dx = node.mesh.position.x - slot.nodes[i - 1]!.mesh.position.x;
                    const dy = node.mesh.position.y - slot.nodes[i - 1]!.mesh.position.y;
                    node.mesh.rotation.z = Math.atan2(dx, dy);
                }
            }
        }
    }

    applyImpulse(group: THREE.Group, nodeIndex: number, ax: number, ay: number): void {
        if (!verletBodyPool.isReady) return;
        const slot = this.slots.find((s) => s.group === group);
        if (!slot || nodeIndex < 0 || nodeIndex >= slot.bodyCount) return;
        verletBodyPool.exports?.addBodyAcceleration!(slot.bodyStart + nodeIndex, ax, ay);
    }

    repack(cursor: number): number {
        if (!verletBodyPool.isReady) return cursor;
        const exports = verletBodyPool.exports;
        if (!exports) return cursor;
        let next = cursor;
        for (const slot of this.slots) {
            for (let i = 0; i < slot.bodyCount; i++) {
                const node = slot.nodes[i];
                const x = node?.mesh.position.x ?? slot.restX[i];
                const y = node?.mesh.position.y ?? slot.restY[i];
                exports.setBodyPosition!(next + i, x, y);
            }
            slot.bodyStart = next;
            next += slot.bodyCount;
        }
        return next;
    }

    private ensureRegistered(): void {
        if (this.registered) return;
        verletBodyPool.register({
            id: 'vacuum-kelp',
            repack: (cursor) => this.repack(cursor)
        });
        this.registered = true;
    }

    /** Retry queued strands after the shared Verlet pool binds WASM. */
    flushPending(): void {
        const queued = this.pending.splice(0);
        for (const group of queued) {
            this.tryAttach(group);
        }
    }
}

export const vacuumKelpSoftBody = new VacuumKelpSoftBody();

export type KelpGameplayContext = {
    playerPosition: THREE.Vector3;
    delta: number;
    projectiles: Array<{ active: boolean; mesh: THREE.Object3D; deactivate: () => void }>;
    harvest: (tag: string, event: 'destroy', position: THREE.Vector3, options?: { precision?: boolean }) => void;
    emit: (position: THREE.Vector3, color: number, count: number) => void;
};

export type KelpGameplayResult = {
    inContact: boolean;
    drainPerSec: number;
    speedMul: number;
};

const _world = new THREE.Vector3();

export function tickVacuumKelpGameplay(
    group: THREE.Group,
    ctx: KelpGameplayContext,
    consecutiveContact: number
): KelpGameplayResult {
    const nodes = group.userData.nodeStates as VacuumKelpNodeState[] | undefined;
    const result: KelpGameplayResult = {
        inContact: false,
        drainPerSec: 0,
        speedMul: 1
    };
    if (!nodes) return result;

    for (const proj of ctx.projectiles) {
        if (!proj.active) continue;
        for (const node of nodes) {
            if (!node.alive) continue;
            node.mesh.getWorldPosition(_world);
            if (proj.mesh.position.distanceTo(_world) > 1.1) continue;
            proj.deactivate();
            node.hp -= 20;
            ctx.emit(_world.clone(), 0x44ddff, 6);
            vacuumKelpSoftBody.applyImpulse(group, node.mesh.userData.idx as number, 40, 20);
            if (node.hp <= 0) {
                severKelpNode(group, node, ctx);
            }
            break;
        }
    }

    for (const node of nodes) {
        if (!node.alive) continue;
        node.mesh.getWorldPosition(_world);
        if (ctx.playerPosition.distanceTo(_world) < KELP_CONTACT_RADIUS) {
            result.inContact = true;
            break;
        }
    }

    if (result.inContact) {
        result.drainPerSec = kelpDrainPerSec(consecutiveContact);
        result.speedMul = kelpSpeedMultiplier(true);
    }
    return result;
}

function severKelpNode(group: THREE.Group, node: VacuumKelpNodeState, ctx: KelpGameplayContext): void {
    node.alive = false;
    node.mesh.visible = false;
    node.mesh.userData.severed = true;
    node.mesh.getWorldPosition(_world);
    const pos = _world.clone();
    ctx.harvest('vacuumKelp', 'destroy', pos);
    ctx.emit(pos, 0x88ffcc, 12);
}

export function kelpConfigFromRng(random: () => number): KelpConfig {
    return pickKelpConfig(random);
}
