import * as THREE from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { time, positionLocal, color, sin, mix, float, uniform } from 'three/tsl';
import type { TSLNode } from '../tsl_types';
import {
    magmaCycleAt,
    magmaGlobCount,
    magmaGlobDirections,
    MAGMA_GLOB_RADIUS,
    MAGMA_GLOB_SPEED,
    MAGMA_CORE_HP,
    type MagmaPhase
} from './flora_gameplay';

const _tmp = new THREE.Vector3();

type MagmaGlob = {
    mesh: THREE.Mesh;
    vx: number;
    vy: number;
    vz: number;
    life: number;
};

function createHeartMaterial(pressureUniform: ReturnType<typeof uniform>) {
    const mat = new MeshStandardNodeMaterial({
        color: 0x220000,
        roughness: 0.9
    });
    const uTime = time;
    const pos = positionLocal;
    const noise = sin(pos.x.mul(5.0).add(uTime)).mul(sin(pos.y.mul(5.0))).add(sin(pos.z.mul(5.0)));
    const lavaColor = color(0xff3300);
    const rockColor = color(0x000000);
    const heat: TSLNode = mix(float(0.35), float(1.4), pressureUniform);
    mat.emissiveNode = mix(rockColor, lavaColor, noise.max(0.0).mul(2.0).mul(heat));
    return mat;
}

/** Magma hearts (pulsing, erupting) — kept separate from liquid-metal system for code-splitting. */
export function createMagmaHeart(config: { size: number }): THREE.Mesh {
    const geo = new THREE.SphereGeometry(config.size, 32, 32);
    const uPressure = uniform(0.2);
    const mat = createHeartMaterial(uPressure);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData = {
        type: 'magmaHeart',
        speciesId: 'magmaHeart',
        size: config.size,
        cycleTime: 0,
        phase: 'build' as MagmaPhase,
        telegraph: false,
        eruptedThisCycle: false,
        coreHp: MAGMA_CORE_HP,
        coreAlive: true,
        minedBuild: false,
        uPressure,
        globs: [] as MagmaGlob[],
        globGroup: new THREE.Group()
    };
    mesh.add(mesh.userData.globGroup as THREE.Group);
    return mesh;
}

export function updateMagmaHeart(mesh: THREE.Mesh, delta: number, _timeVal: number): void {
    if (!mesh.userData.coreAlive) {
        mesh.visible = false;
        return;
    }
    mesh.userData.cycleTime = (mesh.userData.cycleTime as number) + delta;
    const cycle = magmaCycleAt(mesh.userData.cycleTime as number);
    const prev = mesh.userData.phase as MagmaPhase;
    mesh.userData.phase = cycle.phase;
    mesh.userData.telegraph = cycle.telegraph;
    const uPressure = mesh.userData.uPressure as { value: number } | undefined;
    if (uPressure) uPressure.value = cycle.pressure;

    const beat = cycle.phase === 'critical' ? 8 : cycle.phase === 'eruption' ? 12 : 5;
    const pulse = Math.sin(_timeValSafe(mesh) * beat);
    const scale = 1.0 + Math.pow(Math.max(0, pulse), 4.0) * (0.08 + cycle.pressure * 0.12);
    const coolShrink = cycle.phase === 'cooldown' ? 0.72 + cycle.phaseT * 0.05 : 1;
    mesh.scale.setScalar(scale * coolShrink);
    mesh.rotation.y += delta * (0.1 + cycle.pressure * 0.2);

    if (cycle.phase === 'eruption' && prev !== 'eruption') {
        spawnGlobs(mesh);
        mesh.userData.eruptedThisCycle = true;
    }
    if (cycle.phase !== 'eruption') {
        mesh.userData.eruptedThisCycle = false;
    }

    stepGlobs(mesh, delta);
}

function _timeValSafe(mesh: THREE.Mesh): number {
    return (mesh.userData.cycleTime as number) || 0;
}

function spawnGlobs(heart: THREE.Mesh): void {
    const group = heart.userData.globGroup as THREE.Group;
    const existing = heart.userData.globs as MagmaGlob[];
    for (const g of existing) {
        group.remove(g.mesh);
    }
    existing.length = 0;

    const count = magmaGlobCount(Math.random);
    const dirs = magmaGlobDirections(count);
    const geo = new THREE.SphereGeometry(MAGMA_GLOB_RADIUS, 8, 8);
    const mat = new THREE.MeshStandardMaterial({
        color: 0xff6622,
        emissive: 0xff2200,
        emissiveIntensity: 1.4
    });
    for (const dir of dirs) {
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(0, 0, 0);
        group.add(mesh);
        existing.push({
            mesh,
            vx: dir.x * MAGMA_GLOB_SPEED,
            vy: dir.y * MAGMA_GLOB_SPEED,
            vz: dir.z * MAGMA_GLOB_SPEED,
            life: 2.4
        });
    }
}

function stepGlobs(heart: THREE.Mesh, delta: number): void {
    const globs = heart.userData.globs as MagmaGlob[];
    for (const glob of globs) {
        glob.life -= delta;
        glob.vy -= 6 * delta;
        glob.mesh.position.x += glob.vx * delta;
        glob.mesh.position.y += glob.vy * delta;
        glob.mesh.position.z += glob.vz * delta;
        glob.mesh.visible = glob.life > 0;
    }
}

export type MagmaTickContext = {
    playerPosition: THREE.Vector3;
    projectiles: Array<{ active: boolean; mesh: THREE.Object3D; deactivate: () => void }>;
    harvest: (tag: string, event: 'destroy', position: THREE.Vector3) => void;
    emit: (position: THREE.Vector3, color: number, count: number) => void;
};

export type MagmaTickResult = {
    phase: MagmaPhase;
    telegraph: boolean;
    globHit: boolean;
    coreDestroyed: boolean;
    rumble: number;
};

export function tickMagmaHeartGameplay(mesh: THREE.Mesh, ctx: MagmaTickContext): MagmaTickResult {
    const phase = (mesh.userData.phase as MagmaPhase) || 'build';
    const result: MagmaTickResult = {
        phase,
        telegraph: !!mesh.userData.telegraph,
        globHit: false,
        coreDestroyed: false,
        rumble: phase === 'critical' ? 0.55 : phase === 'eruption' ? 1 : phase === 'build' ? 0.15 : 0.05
    };
    if (!mesh.userData.coreAlive) return result;

    const size = (mesh.userData.size as number) || 3;
    const globs = mesh.userData.globs as MagmaGlob[];
    for (const glob of globs) {
        if (glob.life <= 0 || !glob.mesh.visible) continue;
        glob.mesh.getWorldPosition(_tmp);
        if (ctx.playerPosition.distanceTo(_tmp) < MAGMA_GLOB_RADIUS + 0.7) {
            result.globHit = true;
            glob.life = 0;
            glob.mesh.visible = false;
        }
    }

    for (const proj of ctx.projectiles) {
        if (!proj.active) continue;
        if (proj.mesh.position.distanceTo(mesh.position) > size * 1.15) continue;
        proj.deactivate();
        ctx.emit(proj.mesh.position.clone(), 0xff6622, 8);
        if (phase === 'build' && !mesh.userData.minedBuild) {
            mesh.userData.minedBuild = true;
            ctx.harvest('magmaHeart', 'destroy', mesh.position.clone());
        }
        if (phase === 'cooldown') {
            mesh.userData.coreHp = (mesh.userData.coreHp as number) - 40;
            if ((mesh.userData.coreHp as number) <= 0) {
                mesh.userData.coreAlive = false;
                mesh.visible = false;
                result.coreDestroyed = true;
                ctx.harvest('magmaHeart', 'destroy', mesh.position.clone());
                ctx.emit(mesh.position.clone(), 0xffaa33, 24);
            }
        }
    }

    if (phase === 'build') mesh.userData.minedBuild = mesh.userData.minedBuild && true;
    if (phase !== 'build') mesh.userData.minedBuild = false;

    return result;
}
