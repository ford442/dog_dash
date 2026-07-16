import * as THREE from 'three';
import { uniform } from 'three/tsl';
import { WeaponLightManager } from '../lighting';
import { IndustrialLayer, AnimatedMechanismLayer, TunnelLayer } from './layers';
import { createPulsingConduitMaterial } from './materials';

export class IndustrialBackgroundSystem {
    scene: THREE.Scene;
    layers: (IndustrialLayer | AnimatedMechanismLayer)[] = [];
    tunnel!: TunnelLayer;
    active: boolean = false;
    elapsedTime: number = 0;
    uPlayerPos: any;

    weaponLightManager: WeaponLightManager;
    constructor(scene: THREE.Scene, weaponLightManager: WeaponLightManager) {
        this.scene = scene;
        this.weaponLightManager = weaponLightManager;
        this.uPlayerPos = uniform(new THREE.Vector3(0, 0, 0));
        this.initLayers();
    }

    initLayers() {
        // Tunnel Wall (Vast Background)
        this.tunnel = new TunnelLayer(this.scene, this.uPlayerPos, this.weaponLightManager.storageNode);

        // Layer 1: Deep Background Pipes (Dark, massive)
        // Position: Z = -40, moving parallax
        const pipeGeo = new THREE.CylinderGeometry(2, 2, 40, 16); // Long pipes
        const pipeMat = createPulsingConduitMaterial(0x111122, 0x0044ff, 2.0, this.uPlayerPos, this.weaponLightManager.storageNode); // Blue pulse

        this.layers.push(new IndustrialLayer(this.scene, pipeGeo, pipeMat, {
            count: 20,
            z: -40,
            zRange: 10,
            width: 300,
            yRange: 40,
            scaleMin: 1.0,
            scaleMax: 2.0,
            rotationMode: 'horizontal'
        }));

        // Layer 2: Mid-ground Conveyor Belts / Structs
        // Position: Z = -20
        const beltGeo = new THREE.BoxGeometry(10, 1, 2); // Flat belt segments
        const beltMat = createConveyorMaterial(5.0, this.uPlayerPos, this.weaponLightManager.storageNode); // Fast moving stripes

        this.layers.push(new IndustrialLayer(this.scene, beltGeo, beltMat, {
            count: 30,
            z: -20,
            zRange: 5,
            width: 200,
            yRange: 30,
            scaleMin: 1.0,
            scaleMax: 1.5,
            rotationMode: 'horizontal'
        }));

        // New Layer: Background Pistons (Animated)
        // Position: Z = -15
        const pistonGeo = createPistonGeometry(1.5, 8);
        const pistonMat = createMechanismMaterial(0x555555, this.uPlayerPos, this.weaponLightManager.storageNode);

        this.layers.push(new AnimatedMechanismLayer(this.scene, pistonGeo, pistonMat, {
            count: 12,
            z: -15,
            zRange: 5,
            width: 200,
            yRange: 20,
            scaleMin: 0.8,
            scaleMax: 1.2,
            animationType: 'piston'
        }));

        // Layer 3: Vertical Support Ribs (Background wall details)
        // Position: Z = -12
        const ribGeo = new THREE.BoxGeometry(2, 40, 2);
        const ribMat = createSimpleIndustrialMaterial(0x443322, 0.9, 0.5, this.uPlayerPos, this.weaponLightManager.storageNode);

        this.layers.push(new IndustrialLayer(this.scene, ribGeo, ribMat, {
            count: 15,
            z: -12,
            zRange: 2,
            width: 150,
            yRange: 10,
            scaleMin: 1.0,
            scaleMax: 1.0,
            rotationMode: 'vertical'
        }));


        // New Layer: Foreground Pistons (Animated, Occlusion)
        // Position: Z = 12 (Passes in front of player)
        const fgPistonGeo = createPistonGeometry(2.0, 15);
        const fgPistonMat = createMechanismMaterial(0x666666, this.uPlayerPos, this.weaponLightManager.storageNode);

        this.layers.push(new AnimatedMechanismLayer(this.scene, fgPistonGeo, fgPistonMat, {
            count: 6,
            z: 12,
            zRange: 2,
            width: 150,
            yRange: 25,
            scaleMin: 1.0,
            scaleMax: 1.5,
            animationType: 'piston'
        }));

        // New Layer: Foreground Gears (Animated, Occlusion)
        // Position: Z = 10 (Passes in front of player)
        const gearGeo = createGearGeometry(3, 12, 0.5);
        const gearMat = createMechanismMaterial(0x885533, this.uPlayerPos, this.weaponLightManager.storageNode); // Rusty copper/bronze

        this.layers.push(new AnimatedMechanismLayer(this.scene, gearGeo, gearMat, {
            count: 6,
            z: 10,
            zRange: 4,
            width: 150,
            yRange: 15,
            scaleMin: 1.0,
            scaleMax: 2.0,
            animationType: 'rotate'
        }));

        // Layer 4: Foreground Pillars (Occlusion)
        // Position: Z = 8 (In front of player at Z=0)
        // Large, dark, imposing vertical structures
        const fgPillarGeo = new THREE.BoxGeometry(3, 50, 3);
        const fgMat = createForegroundMaterial(this.uPlayerPos, this.weaponLightManager.storageNode);

        this.layers.push(new IndustrialLayer(this.scene, fgPillarGeo, fgMat, {
            count: 5, // Sparse
            z: 8,
            zRange: 2,
            width: 150,
            yRange: 10, // Centered roughly
            scaleMin: 1.0,
            scaleMax: 1.2,
            rotationMode: 'vertical'
        }));

        // Layer 5: Foreground Cables (Hanging)
        // Position: Z = 6
        const cableGeo = new THREE.CylinderGeometry(0.2, 0.2, 30, 8);
        const cableMat = createSimpleIndustrialMaterial(0x000000, 0.8, 0.0, this.uPlayerPos, this.weaponLightManager.storageNode);

        this.layers.push(new IndustrialLayer(this.scene, cableGeo, cableMat, {
            count: 8,
            z: 6,
            zRange: 1,
            width: 120,
            yRange: 5,
            scaleMin: 0.8,
            scaleMax: 1.2,
            rotationMode: 'vertical'
        }));
    }

    activate() {
        if (this.active) return;
        this.active = true;
        this.tunnel.mesh.visible = true;
        this.layers.forEach(l => l.mesh.visible = true);
    }

    deactivate() {
        if (!this.active) return;
        this.active = false;
        this.tunnel.mesh.visible = false;
        this.layers.forEach(l => l.mesh.visible = false);
    }

    update(cameraX: number, delta: number = 0.016, playerPos?: THREE.Vector3) {
        if (playerPos) this.uPlayerPos.value.copy(playerPos);
        if (!this.active) return;
        this.elapsedTime += delta;

        this.tunnel.update(cameraX);

        this.layers.forEach(l => {
            if (l instanceof AnimatedMechanismLayer) {
                l.update(delta, cameraX, this.elapsedTime);
            } else {
                l.update(cameraX);
            }
        });
    }
}
