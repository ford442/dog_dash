import * as THREE from 'three';
import { uniform } from 'three/tsl';
import { WeaponLightManager } from '../lighting';
import { decorationBudget } from '../decoration_budget';
import { PulseOverlay } from './pulse_overlay';
import { NebulaCloudLayer, EnergyParticleLayer, ButterflyEnergyMoteLayer } from './cloud_layers';
import { NebulaRibbonLayer, type NebulaRibbonLayerConfig } from './ribbon_layers';

export class NebulaSystem {
    scene: THREE.Scene;
    active: boolean = false;
    ribbonsActive: boolean = false;
    layers: (NebulaCloudLayer | EnergyParticleLayer | ButterflyEnergyMoteLayer)[] = [];
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
        this.pulseOverlay.init(this.uGlobalPulse, camera);
    }

    /** Tint ribbons from LEVEL_CONFIG skyColors (call on level start / sky transition). */
    setSkyColors(topHex: number, bottomHex: number): void {
        this.ribbonLayers.forEach((layer) => layer.setSkyColors(topHex, bottomHex));
    }

    /**
     * Parallax ribbon/veil sheets only (3 draw calls).
     * Background only — ignore for collision and interaction systems.
     */
    initRibbonLayers(topColor: number = 0x0a001a, bottomColor: number = 0x1a0033): void {
        if (this.ribbonLayers.length > 0) return;

        const configs: NebulaRibbonLayerConfig[] = [
            {
                count: 8,
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
            },
            {
                count: 10,
                width: 380,
                height: 48,
                baseZ: -98,
                zSpread: 14,
                ribbonWidth: 52,
                ribbonHeight: 16,
                opacity: 0.16,
                parallaxFactor: 0.14,
                driftSpeed: 0.55,
                topColor,
                bottomColor,
                uvPhase: 1.7
            },
            {
                count: 6,
                width: 340,
                height: 42,
                baseZ: -72,
                zSpread: 10,
                ribbonWidth: 44,
                ribbonHeight: 20,
                opacity: 0.1,
                parallaxFactor: 0.22,
                driftSpeed: 0.75,
                topColor,
                bottomColor,
                uvPhase: 3.1
            }
        ];

        for (const cfg of configs) {
            this.ribbonLayers.push(new NebulaRibbonLayer(this.scene, cfg));
        }

        decorationBudget.syncCount('nebula_ribbons', 24);
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

        this.layers.push(new NebulaCloudLayer(this.scene, {
            count: 20,
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

        this.layers.push(new NebulaCloudLayer(this.scene, {
            count: 15,
            color1: 0x00008b,
            color2: 0x00ced1,
            opacity: 0.3,
            sizeMin: 15,
            sizeMax: 25,
            z: -40,
            zRange: 15,
            width: 250,
            height: 50,
            uGlobalPulse: this.uGlobalPulse,
            weaponLights: weaponLights,
            uMagicIntensity: this.uMagicIntensity
        }));

        this.layers.push(new NebulaCloudLayer(this.scene, {
            count: 10,
            color1: 0xff1493,
            color2: 0xff69b4,
            opacity: 0.15,
            sizeMin: 10,
            sizeMax: 20,
            z: -20,
            zRange: 10,
            width: 200,
            height: 40,
            uGlobalPulse: this.uGlobalPulse,
            weaponLights: weaponLights,
            uMagicIntensity: this.uMagicIntensity
        }));

        this.layers.push(new EnergyParticleLayer(this.scene, 30, -30, 200, this.uGlobalPulse));
        this.layers.push(new ButterflyEnergyMoteLayer(this.scene, 20, -25, 200, this.uGlobalPulse, this.uMagicIntensity));

        decorationBudget.syncCount('nebula_cloud_puffs', 45);
        decorationBudget.syncCount('nebula_energy_motes', 50);
        decorationBudget.syncCount('nebula_ribbons', 24);

        this.deactivate();
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
