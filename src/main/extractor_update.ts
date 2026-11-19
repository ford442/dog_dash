/**
 * Extractor Beam sim step (Plasma Caster alt-fire, hold E / touch 🧪).
 *
 * Runs inside `updateLoopGeological` with `SIM_STEP`. Steps the beam state
 * machine against the live GeologicalWorld, drains ship energy, banks
 * materials through the ResourceHarvester (`'extract'` event), pulls nearby
 * enemies toward a rooted ship, and drives the hum + beam visuals.
 *
 * Grants are deterministic (no RNG); input is the held EXTRACT bit, so a
 * replay reproduces every siphon exactly.
 */

import * as THREE from 'three';
import { playerState } from '../game_config';
import { game } from '../game_runtime';
import { extractHeld } from './sim_input';
import { collectExtractCandidates } from '../extractor/candidates';
import { EXTRACT_ATTRACT_RADIUS, type ExtractorStepResult } from '../extractor/beam';
import { EXTRACT_YIELDS } from '../extractor/yields';
import { ExtractorBeamVfx } from '../extractor/vfx';
import { MATERIAL_META } from '../resource_inventory';

/** Visual-only; rebuilt if the scene changes (e.g. a fresh headless boot). */
let vfx: ExtractorBeamVfx | null = null;
let vfxScene: THREE.Scene | null = null;
let wasOutOfEnergy = false;

const _from = new THREE.Vector3();

export interface ExtractorHudState {
    label: string;
    progress: number;
}

export function updateExtractorBeam(delta: number): {
    step: ExtractorStepResult<THREE.Object3D> | null;
    hud: ExtractorHudState | null;
} {
    const player = game.player;
    if (!player) return { step: null, hud: null };

    const step = game.extractorBeam.step({
        dt: delta,
        held: extractHeld(),
        energy: playerState.energy,
        shipX: player.position.x,
        shipY: player.position.y,
        shipZ: player.position.z,
        candidates: collectExtractCandidates(game.env.geologicalWorld)
    });

    if (step.energyDrain > 0) {
        playerState.energy = Math.max(0, playerState.energy - step.energyDrain);
    }

    const target = step.target;
    if (target && step.material && step.granted > 0) {
        game.resourceHarvester.grant(step.material, step.granted, 'extract', target.ref.position.clone());
        game.audioSystem.playCollect();
    }
    if (target && step.depleted) {
        const label = EXTRACT_YIELDS[target.species].label;
        game.juiceManager.showFloatingText(`${label} siphoned!`, target.ref.position.clone(), MATERIAL_META[EXTRACT_YIELDS[target.species].material].color, 20);
        game.particleSystem.emit(target.ref.position.clone(), 0x66ffcc, 14, 3.0, 0.4, 0.8);
    }
    if (step.outOfEnergy && !wasOutOfEnergy) {
        game.juiceManager.showFloatingText('Beam needs ⚡', player.position.clone(), '#ffdd66', 16);
    }
    wasOutOfEnergy = step.outOfEnergy;

    // Rooted ship is a beacon: enemies within range drift in.
    game.obstacleSystem.attraction = target
        ? { x: player.position.x, y: player.position.y, radius: EXTRACT_ATTRACT_RADIUS, speed: 3 }
        : null;

    game.audioSystem.updateExtractorHum(target ? 1 : step.beaming ? 0.3 : 0, step.progress);

    if (vfxScene !== game.scene) {
        vfx?.dispose();
        vfx = new ExtractorBeamVfx(game.scene);
        vfxScene = game.scene;
    }
    if (target && vfx) {
        _from.copy(player.position);
        _from.x += 1.2;
        const radius = (target.ref.userData.radius as number | undefined)
            ?? (target.ref.userData.fieldRadius as number | undefined)
            ?? 2;
        vfx.show(_from, target.ref.position, Math.min(radius, 6), step.progress, delta);
    } else {
        vfx?.hide();
    }

    const hud = target
        ? { label: EXTRACT_YIELDS[target.species].label, progress: step.progress }
        : step.beaming
            ? { label: 'Searching…', progress: 0 }
            : null;
    return { step, hud };
}
