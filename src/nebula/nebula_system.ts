import * as THREE from 'three';
import { uniform } from 'three/tsl';
import { WeaponLightManager } from '../lighting';
import { decorationBudget } from '../decoration_budget';
import { PulseOverlay } from './pulse_overlay';
import { NebulaCloudLayer, ButterflyEnergyMoteLayer } from './cloud_layers';
import { NebulaRibbonLayer, type NebulaRibbonLayerConfig } from './ribbon_layers';

/**
 * Fixed-pool sizes. Keep in sync with `decoration_budget.ts` maxActive for
 * `nebula_cloud_puffs` / `nebula_energy_motes` / `nebula_ribbons`.
 */
const NEBULA_CLOUD_PUFF_COUNT = 20;
const NEBULA_MOTE_COUNT = 20;
const NEBULA_RIBBON_COUNT = 8;

/**
 * Full-screen pulse overlay: an extra fullscreen transparent pass every frame
 * for a subtle brightness throb. Off by default; opt in per level only if a
 * beat actually needs it.
 */
const PULSE_OVERLAY_ENABLED = false;

export class NebulaSystem {
    scene: THREE.Scene;
    active: boolean = false;
    ribbonsActive: boolean = false;
    layers: (NebulaCloudLayer | ButterflyEnergyMoteLayer)[] = [];
    ribbonLayers: NebulaRibbonLayer[] = [];
    uGlobalPulse: any;
    uMagicIntensity: any;
    targetMagicIntensity: number = 0.0;
    pulseOverlay: PulseOverlay;
    elapsedTime: number = 0;
    weaponLightManager: WeaponLightManager;

    constructor(scene: THREE.Scene, weaponLightManager: WeaponLightManager) {
        this.scene = scene;
        this.uGlobalPulse = uniform(0.0);
        this.uMagicIntensity = uniform(0.0);
        this.pulseOverlay = new PulseOverlay();
        this.weaponLightManager = weaponLightManager;
        this.initRibbonLayers();
        this.initLayers();
    }

    setCamera(camera: THREE.Camera) {
        if (!PULSE_OVERLAY_ENABLED) return;
        this.pulseOverlay.init(this.uGlobalPulse, camera);
    }

    /** Tint ribbons from LEVEL_CONFIG skyColors (call on level start / sky transition). */
    setSkyColors(topHex: number, bottomHex: number): void {
        this.ribbonLayers.forEach((layer) => layer.setSkyColors(topHex, bottomHex));
    }

    /**
     * Parallax ribbon/veil sheets — a single 8-instance layer (1 draw call).
     * Background only — ignore for collision and interaction systems.
     */
    initRibbonLayers(topColor: number = 0x0a001a, bottomColor: number = 0x1a0033): void {
        if (this.ribbonLayers.length > 0) return;

        const configs: NebulaRibbonLayerConfig[] = [
            {
                count: NEBULA_RIBBON_COUNT,
                width: 420,
                height: 55,
                baseZ: -145,
                zSpread: 18,
                ribbonWidth: 72,
                ribbonHeight: 28,
                opacity: 0.11,
                parallaxFactor: 0.07,
                driftSpeed: 0.35,
                topColor,
                bottomColor,
                uvPhase: 0.0
            }
        ];

        for (const cfg of configs) {
            this.ribbonLayers.push(new NebulaRibbonLayer(this.scene, cfg));
        }

        decorationBudget.syncCount('nebula_ribbons', NEBULA_RIBBON_COUNT);
        this.deactivateRibbons();
    }

    activateRibbons(): void {
        this.ribbonsActive = true;
        this.ribbonLayers.forEach((layer) => { layer.mesh.visible = true; });
    }

    deactivateRibbons(): void {
        this.ribbonsActive = false;
        this.ribbonLayers.forEach((layer) => { layer.mesh.visible = false; });
    }

    initLayers() {
        const weaponLights = this.weaponLightManager.storageNode;

        // One cloud layer only. The old three-layer stack (20 + 15 + 10 puffs at
        // three depths) was almost pure overdraw on top of the starfield.
        this.layers.push(new NebulaCloudLayer(this.scene, {
            count: NEBULA_CLOUD_PUFF_COUNT,
            color1: 0x4b0082,
            color2: 0x8a2be2,
            opacity: 0.4,
            sizeMin: 20,
            sizeMax: 40,
            z: -60,
            zRange: 20,
            width: 300,
            height: 60,
            uGlobalPulse: this.uGlobalPulse,
            weaponLights: weaponLights,
            uMagicIntensity: this.uMagicIntensity
        }));

        this.layers.push(new ButterflyEnergyMoteLayer(
            this.scene,
            NEBULA_MOTE_COUNT,
            -25,
            200,
            this.uGlobalPulse,
            this.uMagicIntensity
        ));

        this.resyncBudgetCounts();

        this.deactivate();
    }

    /** Re-sync fixed-pool budget counters after decorationBudget.resetCounts(). */
    resyncBudgetCounts(): void {
        decorationBudget.syncCount('nebula_cloud_puffs', NEBULA_CLOUD_PUFF_COUNT);
        decorationBudget.syncCount('nebula_energy_motes', NEBULA_MOTE_COUNT);
        decorationBudget.syncCount('nebula_ribbons', NEBULA_RIBBON_COUNT);
    }

    setMagicActive(isActive: boolean) {
        this.targetMagicIntensity = isActive ? 1.0 : 0.0;
    }

    activate() {
        if (this.active) return;
        this.active = true;
        this.layers.forEach(l => l.mesh.visible = true);
        if (this.pulseOverlay.mesh) this.pulseOverlay.mesh.visible = true;
    }

    deactivate() {
        if (!this.active) return;
        this.active = false;
        this.layers.forEach(l => l.mesh.visible = false);
        if (this.pulseOverlay.mesh) this.pulseOverlay.mesh.visible = false;
    }


    update(delta: number, cameraX: number, playerPos?: THREE.Vector3, playerSpeed: number = 8) {
        if (this.ribbonsActive) {
            this.ribbonLayers.forEach((layer) => layer.update(delta, cameraX, playerSpeed));
        }

        if (!this.active) return;

        // Lerp magic intensity
        const currentMagic = this.uMagicIntensity.value;
        this.uMagicIntensity.value = currentMagic + (this.targetMagicIntensity - currentMagic) * delta * 2.0;

        this.elapsedTime += delta;

        const pulse = Math.sin(this.elapsedTime * 1.0) * 0.5 + 0.5;
        this.uGlobalPulse.value = pulse;

        this.layers.forEach(l => {
            if (l instanceof NebulaCloudLayer) {
                l.update(delta, cameraX, playerPos);
            } else {
                l.update(delta, cameraX);
            }
        });
    }
}
