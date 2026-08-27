import * as THREE from 'three';
import { uniform } from 'three/tsl';
import { LevelConfig } from '../level_config';
import { WeaponLightManager } from '../lighting';
import { CloudLayer } from './layer';
import { GodRayOverlay, LightningFlashOverlay } from './overlays';

export class CloudSystem {

    scene: THREE.Scene;
    layers: CloudLayer[] = [];
    lightningTimer: number = 0;
    currentCameraX: number = 0;
    weaponLightManager?: WeaponLightManager;
    uPlayerPos: any;
    flashOverlay: LightningFlashOverlay;
    godRayOverlay: GodRayOverlay;

    constructor(scene: THREE.Scene, weaponLightManager?: WeaponLightManager) {
        this.scene = scene;
        this.weaponLightManager = weaponLightManager;
        this.uPlayerPos = uniform(new THREE.Vector3(0, 0, 0));
        this.flashOverlay = new LightningFlashOverlay();
        this.godRayOverlay = new GodRayOverlay();
        this.initLayers();
    }

    setCamera(camera: THREE.Camera) {
        this.flashOverlay.init(camera);
        this.godRayOverlay.init(camera);
    }

    setLevel(config: LevelConfig) {
        const baseColor = new THREE.Color(config.skyColors.bottom);
        const cloudDensity = config.foliageDensity?.cloud ?? 20;

        // Base opacity multiplier based on density config (20 is baseline)
        const densityFactor = Math.min(1.0, cloudDensity / 20.0);

        if (this.layers.length >= 5) {
            // Layer 1: Deep Background (Slowest, Faint, Huge)
            this.layers[0].uColor.value.copy(baseColor).lerp(new THREE.Color(0x000000), 0.5); // Very dark
            this.layers[0].uOpacity.value = 0.9 * densityFactor;

            // Layer 2: Background (Dark, slightly faster)
            this.layers[1].uColor.value.copy(baseColor).lerp(new THREE.Color(0x000000), 0.3); // Dark
            this.layers[1].uOpacity.value = 0.8 * densityFactor;

            // Layer 3: Mid-Ground (Main cloud layer, semi-transparent)
            this.layers[2].uColor.value.copy(baseColor).lerp(new THREE.Color(0xffffff), 0.1); // Slightly lighter
            this.layers[2].uOpacity.value = 0.6 * densityFactor;

            // Layer 4: Near-Mid (Lighter, faster)
            this.layers[3].uColor.value.copy(baseColor).lerp(new THREE.Color(0xffffff), 0.3); // Lighter
            this.layers[3].uOpacity.value = 0.4 * densityFactor;

            // Layer 5: Foreground (Passes in front/very close, fast, transparent, detailed)
            this.layers[4].uColor.value.copy(baseColor).lerp(new THREE.Color(0xffffff), 0.5); // Lightest
            this.layers[4].uOpacity.value = 0.2 * densityFactor;
        }

        // Handle fully hiding if density is 0
        const visible = cloudDensity > 0;
        this.layers.forEach(layer => layer.mesh.visible = visible);
    }


    pendingFlashes: {
        layerIdx: number;
        position: THREE.Vector3;
        radius: number;
        intensity: number;
        color?: THREE.Color;
        delay: number;
    }[] = [];

    initLayers() {
        // "Thunder Force IV" Style - 5 Layers

        // Layer 1: Deep Background (Slowest, Faint, Huge)
        // Crawls slowly to the left (negative speed)
        this.layers.push(new CloudLayer(this.scene, {
            count: 25,
            z: -80,
            zRange: 20,
            uColor: uniform(new THREE.Color(0x0a0a20)), // Very dark blue
            uOpacity: uniform(0.9),
            scaleMin: 40,
            scaleMax: 60,
            windSpeed: -2.0, // Crawl
            width: 400,
            detail: 0.5,
            weaponLights: this.weaponLightManager ? this.weaponLightManager.storageNode : undefined,
            uPlayerPos: this.uPlayerPos
        }));

        // Layer 2: Background (Dark, slightly faster)
        this.layers.push(new CloudLayer(this.scene, {
            count: 30,
            z: -50,
            zRange: 15,
            uColor: uniform(new THREE.Color(0x151530)),
            uOpacity: uniform(0.8),
            scaleMin: 30,
            scaleMax: 45,
            windSpeed: -3.0,
            width: 350,
            detail: 0.8,
            weaponLights: this.weaponLightManager ? this.weaponLightManager.storageNode : undefined,
            uPlayerPos: this.uPlayerPos
        }));

        // Layer 3: Mid-Ground (Main cloud layer, semi-transparent)
        this.layers.push(new CloudLayer(this.scene, {
            count: 40,
            z: -25,
            zRange: 10,
            uColor: uniform(new THREE.Color(0x2a2a50)),
            uOpacity: uniform(0.6),
            scaleMin: 20,
            scaleMax: 30,
            windSpeed: -5.0,
            width: 300,
            detail: 1.0,
            weaponLights: this.weaponLightManager ? this.weaponLightManager.storageNode : undefined,
            uPlayerPos: this.uPlayerPos
        }));

        // Layer 4: Near-Mid (Lighter, faster)
        this.layers.push(new CloudLayer(this.scene, {
            count: 20,
            z: -10,
            zRange: 5,
            uColor: uniform(new THREE.Color(0x444477)),
            uOpacity: uniform(0.4),
            scaleMin: 15,
            scaleMax: 20,
            windSpeed: -8.0,
            width: 250,
            detail: 1.5,
            weaponLights: this.weaponLightManager ? this.weaponLightManager.storageNode : undefined,
            uPlayerPos: this.uPlayerPos
        }));

        // Layer 5: Foreground (Passes in front/very close, fast, transparent, detailed)
        // Z > 0 (Player is at 0)
        this.layers.push(new CloudLayer(this.scene, {
            count: 10,
            z: 8,
            zRange: 4,
            uColor: uniform(new THREE.Color(0x666699)),
            uOpacity: uniform(0.2),
            scaleMin: 8,
            scaleMax: 12,
            windSpeed: -15.0, // Whoosh
            width: 200,
            detail: 2.0,
            weaponLights: this.weaponLightManager ? this.weaponLightManager.storageNode : undefined,
            uPlayerPos: this.uPlayerPos
        }));
    }

    update(delta: number, cameraX: number, playerSpeed: number, playerPos?: THREE.Vector3) {
        if (playerPos) {
            this.uPlayerPos.value.copy(playerPos);
        }
        this.currentCameraX = cameraX;
        this.layers.forEach(layer => layer.update(delta, cameraX));

        // Lightning Logic
        // (Lightning logic moved to external trigger)

        // Process pending flashes
        for (let i = this.pendingFlashes.length - 1; i >= 0; i--) {
            const flash = this.pendingFlashes[i];
            flash.delay -= delta;
            if (flash.delay <= 0) {
                this.layers[flash.layerIdx].flash(flash.position, flash.radius, flash.intensity, flash.color);
                this.pendingFlashes.splice(i, 1);
            }
        }

        // Update full screen flash
        if (this.flashOverlay) {
            this.flashOverlay.update(delta);
        }
        if (this.godRayOverlay) {
            this.godRayOverlay.update(delta);
        }

        // Update flash decay
        this.layers.forEach(layer => {
            const mat = layer.mesh.material as any;
            if (mat.userData && mat.userData.uFlash) {
                const current = mat.userData.uFlash.value;
                if (current > 0.01) {
                    mat.userData.uFlash.value = current * 0.85;
                } else {
                    mat.userData.uFlash.value = 0;
                }
            }
        });
    }

    triggerLightningAt(strikePos: THREE.Vector3, lightningColor?: THREE.Color) {
        if (this.layers.length === 0) return;

        // Find the closest layer by Z distance to the strike
        let closestLayerIdx = 0;
        let minZDist = Infinity;
        for (let i = 0; i < this.layers.length; i++) {
            const dist = Math.abs(this.layers[i].baseZ - strikePos.z);
            if (dist < minZDist) {
                minZDist = dist;
                closestLayerIdx = i;
            }
        }

        const layer = this.layers[closestLayerIdx];
        const radius = 60.0 + Math.random() * 40.0; // Large radius
        const intensity = 0.8 + Math.random() * 0.4;

        layer.flash(strikePos, radius, intensity, lightningColor);

        // Trigger full screen flash overlay
        if (this.flashOverlay) {
            this.flashOverlay.uIntensity.value = intensity;
        }

        // Trigger god rays
        if (this.godRayOverlay) {
            this.godRayOverlay.uIntensity.value = intensity;

            // Map 3D pos to approximate 2D screen UV for the light pos
            if (this.flashOverlay.camera) {
                const screenPos = strikePos.clone().project(this.flashOverlay.camera);
                this.godRayOverlay.uLightPos.value.set((screenPos.x + 1) / 2, (screenPos.y + 1) / 2);
            }
        }

        // Chain reaction (flash nearby layers)
        if (Math.random() > 0.5 && closestLayerIdx < this.layers.length - 1) {
            // Flash next layer with slightly different position/intensity
            const nextLayer = this.layers[closestLayerIdx + 1];
            // Slightly offset z for 3D feel
            const nextPos = strikePos.clone();
            nextPos.z = nextLayer.baseZ;

            this.pendingFlashes.push({
                layerIdx: closestLayerIdx + 1,
                position: nextPos,
                radius: radius * 0.8,
                intensity: intensity * 0.5,
                color: lightningColor,
                delay: 0.1
            });
        }
    }
}
