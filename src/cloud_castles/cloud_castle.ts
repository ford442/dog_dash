/**
 * Cloud Castle geometry and ShootingStarSystem
 */

import * as THREE from 'three';
import { disposeObject } from '../utils';
import {
    PASTEL_COLORS,
    TOWER_COLORS,
    RAINBOW_COLORS,
    createDreamyCloudMaterial,
    createTowerMaterial,
    createWindowGlowMaterial,
    createRainbowMaterial,
    createHeartFlagMaterial
} from './materials';

export class ShootingStarSystem {
    stars: Array<{
        mesh: THREE.Mesh;
        velocity: THREE.Vector3;
        active: boolean;
        life: number;
    }> = [];
    maxStars: number = 5;

    constructor(scene: THREE.Scene) {
        const geometry = new THREE.PlaneGeometry(2, 0.1);
        const material = new THREE.MeshBasicMaterial({
            color: 0xFFFFFF,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending
        });

        for (let i = 0; i < this.maxStars; i++) {
            const mesh = new THREE.Mesh(geometry, material.clone());
            mesh.visible = false;
            scene.add(mesh);

            this.stars.push({
                mesh,
                velocity: new THREE.Vector3(),
                active: false,
                life: 0
            });
        }
    }

    spawn(x: number, y: number, z: number) {
        const star = this.stars.find(s => !s.active);
        if (!star) return;

        star.active = true;
        star.life = 2 + Math.random() * 2;
        star.mesh.position.set(x, y, z);
        star.mesh.visible = true;

        const angle = Math.PI * 0.25 + Math.random() * Math.PI * 0.5;
        const speed = 20 + Math.random() * 30;
        star.velocity.set(
            Math.cos(angle) * speed,
            -Math.sin(angle * 0.3) * speed * 0.3,
            0
        );

        star.mesh.rotation.z = Math.atan2(star.velocity.y, star.velocity.x);
    }

    update(dt: number, cameraX: number) {
        if (Math.random() < 0.005) {
            this.spawn(
                cameraX + 50 + Math.random() * 30,
                10 + Math.random() * 20,
                -40 - Math.random() * 20
            );
        }

        this.stars.forEach(star => {
            if (!star.active) return;

            star.life -= dt;

            if (star.life <= 0) {
                star.active = false;
                star.mesh.visible = false;
                return;
            }

            star.mesh.position.addScaledVector(star.velocity, dt);

            const material = star.mesh.material as THREE.MeshBasicMaterial;
            material.opacity = Math.min(1, star.life) * 0.8;

            const stretch = 1 + star.velocity.length() * 0.02;
            star.mesh.scale.x = stretch;
        });
    }
}

export class CloudCastle {
    group: THREE.Group;
    cloudBase!: THREE.Mesh;
    towers: THREE.Mesh[] = [];
    bridges: THREE.Mesh[] = [];
    decorations: THREE.Object3D[] = [];
    glowLights: THREE.PointLight[] = [];
    windows: THREE.Mesh[] = [];
    flowers: THREE.Mesh[] = [];

    private baseY: number;
    private floatOffset: number;
    private floatSpeed: number;
    private floatAmplitude: number;
    private windowTwinkleTimer: number = 0;
    private scale: number;

    constructor(position: THREE.Vector3, scale: number = 1) {
        this.group = new THREE.Group();
        this.scale = scale;
        this.group.position.copy(position);
        this.group.scale.setScalar(scale);

        this.baseY = position.y;
        this.floatOffset = Math.random() * Math.PI * 2;
        this.floatSpeed = 0.5 + Math.random() * 0.5;
        this.floatAmplitude = 0.3 + Math.random() * 0.4;

        this.createCloudPlatform();
        this.createTowers();
        this.createBridges();
        this.createDecorations();
        this.createGlowLights();
    }

    private createCloudPlatform() {
        const cloudGroup = new THREE.Group();

        const pastelColors = [
            PASTEL_COLORS.cottonCandy,
            PASTEL_COLORS.lavender,
            PASTEL_COLORS.mint,
            PASTEL_COLORS.cream
        ];
        const mainColor = pastelColors[Math.floor(Math.random() * pastelColors.length)];

        const material = createDreamyCloudMaterial(mainColor, 0.85);

        const puffCount = 5 + Math.floor(Math.random() * 4);
        for (let i = 0; i < puffCount; i++) {
            const radius = 1.5 + Math.random() * 1.5;
            const geometry = new THREE.SphereGeometry(radius, 16, 16);
            const puff = new THREE.Mesh(geometry, material);

            const angle = (i / puffCount) * Math.PI * 2 + Math.random() * 0.5;
            const distance = Math.random() * 1.5;
            puff.position.set(
                Math.cos(angle) * distance,
                (Math.random() - 0.5) * 0.8,
                Math.sin(angle) * distance
            );

            const s = 0.8 + Math.random() * 0.4;
            puff.scale.set(s, s * 0.8, s);

            cloudGroup.add(puff);
        }

        const topGeometry = new THREE.CylinderGeometry(2.5, 3, 1, 16);
        const top = new THREE.Mesh(topGeometry, material);
        top.position.y = 0.3;
        cloudGroup.add(top);

        this.cloudBase = cloudGroup as any;
        this.group.add(cloudGroup);
    }

    private createTowers() {
        const towerCount = 2 + Math.floor(Math.random() * 3);

        for (let i = 0; i < towerCount; i++) {
            const angle = (i / towerCount) * Math.PI * 2 + Math.random() * 0.5;
            const distance = 1 + Math.random() * 1.2;
            const height = 2 + Math.random() * 2;

            const towerGroup = new THREE.Group();
            towerGroup.position.set(
                Math.cos(angle) * distance,
                1,
                Math.sin(angle) * distance
            );

            const towerColor = TOWER_COLORS[Math.floor(Math.random() * TOWER_COLORS.length)];
            const material = createTowerMaterial(towerColor);

            const bodyGeo = new THREE.CylinderGeometry(0.4, 0.6, height, 12);
            const body = new THREE.Mesh(bodyGeo, material);
            body.position.y = height / 2;
            body.castShadow = true;
            towerGroup.add(body);

            const turretGeo = new THREE.SphereGeometry(0.5, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2);
            const turret = new THREE.Mesh(turretGeo, material);
            turret.position.y = height;
            towerGroup.add(turret);

            const windowCount = 2 + Math.floor(Math.random() * 2);
            for (let w = 0; w < windowCount; w++) {
                const windowY = height * 0.3 + (w * height * 0.25);
                this.createWindow(towerGroup, windowY, 0.5);
            }

            this.createHeartFlag(towerGroup, height + 0.5);

            this.towers.push(body);
            this.group.add(towerGroup);
        }
    }

    private createWindow(parent: THREE.Group, y: number, x: number) {
        const windowGeo = new THREE.CircleGeometry(0.15, 8);
        const material = createWindowGlowMaterial();
        const window = new THREE.Mesh(windowGeo, material);
        window.position.set(x, y, 0.55);
        parent.add(window);
        this.windows.push(window);
    }

    private createHeartFlag(parent: THREE.Group, y: number) {
        const flagGroup = new THREE.Group();
        flagGroup.position.y = y;

        const poleGeo = new THREE.CylinderGeometry(0.02, 0.02, 1, 6);
        const poleMat = new THREE.MeshStandardMaterial({ color: 0xFFD700 });
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.y = 0.5;
        flagGroup.add(pole);

        const heartGeo = new THREE.PlaneGeometry(0.4, 0.4);
        const heartColor = RAINBOW_COLORS[Math.floor(Math.random() * RAINBOW_COLORS.length)];
        const heartMat = createHeartFlagMaterial(heartColor);
        const heart = new THREE.Mesh(heartGeo, heartMat);
        heart.position.set(0.2, 0.9, 0);
        flagGroup.add(heart);

        flagGroup.userData.animationType = 'flagWave';
        flagGroup.userData.animationOffset = Math.random() * 10;

        parent.add(flagGroup);
        this.decorations.push(flagGroup);
    }

    private createBridges() {
        if (this.towers.length < 2) return;

        const bridgeCount = Math.min(2, this.towers.length - 1);

        for (let i = 0; i < bridgeCount; i++) {
            const bridgeGroup = new THREE.Group();

            const curve = new THREE.QuadraticBezierCurve3(
                new THREE.Vector3(-1.5, 1.5, 0),
                new THREE.Vector3(0, 3, 0),
                new THREE.Vector3(1.5, 1.5, 0)
            );

            const tubeGeo = new THREE.TubeGeometry(curve, 12, 0.15, 8, false);
            const material = createRainbowMaterial();
            const bridge = new THREE.Mesh(tubeGeo, material);

            bridgeGroup.add(bridge);

            this.createBridgeSparkles(bridgeGroup, curve);

            const angle = Math.random() * Math.PI * 2;
            bridgeGroup.position.set(
                Math.cos(angle) * 0.5,
                2,
                Math.sin(angle) * 0.5
            );
            bridgeGroup.rotation.y = Math.random() * Math.PI;

            this.bridges.push(bridge);
            this.group.add(bridgeGroup);
        }
    }

    private createBridgeSparkles(parent: THREE.Group, curve: THREE.QuadraticBezierCurve3) {
        const sparkleCount = 8;
        const sparkleGeo = new THREE.PlaneGeometry(0.1, 0.1);
        const sparkleMat = new THREE.MeshBasicMaterial({
            color: 0xFFFFFF,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending
        });

        for (let i = 0; i < sparkleCount; i++) {
            const t = i / (sparkleCount - 1);
            const point = curve.getPoint(t);

            const sparkle = new THREE.Mesh(sparkleGeo, sparkleMat.clone());
            sparkle.position.copy(point);
            sparkle.position.x += (Math.random() - 0.5) * 0.3;
            sparkle.position.z += (Math.random() - 0.5) * 0.3;

            sparkle.userData = {
                animationType: 'sparkle',
                animationOffset: Math.random() * 10,
                basePos: point.clone()
            };

            parent.add(sparkle);
            this.decorations.push(sparkle);
        }
    }

    private createDecorations() {
        this.createSleepingWindows();
        this.createFlowerGardens();
        this.createBells();
    }

    private createSleepingWindows() {
        const windowCount = 1 + Math.floor(Math.random() * 2);

        for (let i = 0; i < windowCount; i++) {
            const windowGroup = new THREE.Group();

            const frameGeo = new THREE.CircleGeometry(0.3, 16);
            const frameMat = new THREE.MeshBasicMaterial({
                color: 0xFFE4B5,
                transparent: true,
                opacity: 0.5
            });
            const frame = new THREE.Mesh(frameGeo, frameMat);
            windowGroup.add(frame);

            const silhouetteGeo = new THREE.SphereGeometry(0.15, 8, 8);
            const silhouetteMat = new THREE.MeshBasicMaterial({ color: 0x444466 });
            const silhouette = new THREE.Mesh(silhouetteGeo, silhouetteMat);
            silhouette.position.y = -0.05;
            silhouette.scale.y = 0.6;
            windowGroup.add(silhouette);

            windowGroup.position.set(
                (Math.random() - 0.5) * 6,
                2 + Math.random() * 3,
                2 + Math.random() * 2
            );

            windowGroup.userData = {
                animationType: 'float',
                animationOffset: Math.random() * 10,
                floatSpeed: 0.3 + Math.random() * 0.3
            };

            this.group.add(windowGroup);
            this.decorations.push(windowGroup);
        }
    }

    private createFlowerGardens() {
        const gardenCount = 1 + Math.floor(Math.random() * 2);
        const flowerColors = [
            0xFF69B4,
            0xFFD700,
            0xFF6347,
            0xDA70D6,
            0x00CED1
        ];

        for (let i = 0; i < gardenCount; i++) {
            const garden = new THREE.Group();

            const flowerCount = 3 + Math.floor(Math.random() * 4);
            for (let f = 0; f < flowerCount; f++) {
                const flowerColor = flowerColors[Math.floor(Math.random() * flowerColors.length)];
                const flower = this.createGlowingFlower(flowerColor);

                flower.position.set(
                    (Math.random() - 0.5) * 1.5,
                    Math.random() * 0.3,
                    (Math.random() - 0.5) * 1.5
                );

                garden.add(flower);
                this.flowers.push(flower);
            }

            const angle = Math.random() * Math.PI * 2;
            garden.position.set(
                Math.cos(angle) * 1.5,
                1,
                Math.sin(angle) * 1.5
            );

            this.group.add(garden);
            this.decorations.push(garden);
        }
    }

    private createGlowingFlower(colorHex: number): THREE.Mesh {
        const group = new THREE.Group();

        const stemGeo = new THREE.CylinderGeometry(0.02, 0.03, 0.4, 6);
        const stemMat = new THREE.MeshStandardMaterial({ color: 0x228B22 });
        const stem = new THREE.Mesh(stemGeo, stemMat);
        stem.position.y = 0.2;
        group.add(stem);

        const petalGeo = new THREE.SphereGeometry(0.1, 8, 8);
        const petalMat = new THREE.MeshStandardMaterial({
            color: colorHex,
            emissive: colorHex,
            emissiveIntensity: 0.3
        });

        for (let i = 0; i < 5; i++) {
            const petal = new THREE.Mesh(petalGeo, petalMat);
            const angle = (i / 5) * Math.PI * 2;
            petal.position.set(
                Math.cos(angle) * 0.08,
                0.4,
                Math.sin(angle) * 0.08
            );
            petal.scale.set(0.5, 0.3, 0.5);
            group.add(petal);
        }

        const centerGeo = new THREE.SphereGeometry(0.05, 8, 8);
        const centerMat = new THREE.MeshBasicMaterial({ color: 0xFFFFE0 });
        const center = new THREE.Mesh(centerGeo, centerMat);
        center.position.y = 0.4;
        group.add(center);

        group.userData = {
            animationType: 'flowerSway',
            animationOffset: Math.random() * 10
        };

        return group as any;
    }

    private createBells() {
        const bellCount = 1 + Math.floor(Math.random() * 2);

        for (let i = 0; i < bellCount; i++) {
            const bellGroup = new THREE.Group();

            const bellGeo = new THREE.ConeGeometry(0.1, 0.2, 8, 1, true);
            const bellMat = new THREE.MeshStandardMaterial({
                color: 0xFFD700,
                metalness: 0.8,
                roughness: 0.2
            });
            const bell = new THREE.Mesh(bellGeo, bellMat);
            bell.position.y = -0.1;
            bellGroup.add(bell);

            const clapperGeo = new THREE.SphereGeometry(0.03, 6, 6);
            const clapperMat = new THREE.MeshStandardMaterial({ color: 0x444444 });
            const clapper = new THREE.Mesh(clapperGeo, clapperMat);
            clapper.position.y = -0.2;
            bellGroup.add(clapper);

            const stringGeo = new THREE.CylinderGeometry(0.005, 0.005, 0.5, 4);
            const stringMat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });
            const string = new THREE.Mesh(stringGeo, stringMat);
            string.position.y = 0.25;
            bellGroup.add(string);

            bellGroup.position.set(
                (Math.random() - 0.5) * 2,
                4 + Math.random() * 2,
                (Math.random() - 0.5) * 2
            );

            bellGroup.userData = {
                animationType: 'bellSwing',
                animationOffset: Math.random() * 10
            };

            this.group.add(bellGroup);
            this.decorations.push(bellGroup);
        }
    }

    private createGlowLights() {
        const lightCount = Math.min(2, this.windows.length);

        for (let i = 0; i < lightCount; i++) {
            const light = new THREE.PointLight(0xFFE4B5, 0.5, 8);
            light.position.set(
                (Math.random() - 0.5) * 3,
                2 + Math.random() * 2,
                1
            );
            this.group.add(light);
            this.glowLights.push(light);
        }
    }

    float(): void {
        const time = performance.now() * 0.001;
        const y = this.baseY + Math.sin(time * this.floatSpeed + this.floatOffset) * this.floatAmplitude;
        this.group.position.y = y;

        const tiltX = Math.sin(time * this.floatSpeed * 0.5 + this.floatOffset) * 0.02;
        const tiltZ = Math.cos(time * this.floatSpeed * 0.3 + this.floatOffset) * 0.02;
        this.group.rotation.x = tiltX;
        this.group.rotation.z = tiltZ;
    }

    twinkleWindows(): void {
        this.windowTwinkleTimer += 0.016;

        if (this.windowTwinkleTimer > 2 && Math.random() < 0.3) {
            this.windowTwinkleTimer = 0;

            const window = this.windows[Math.floor(Math.random() * this.windows.length)];
            if (window) {
                const material = window.material as THREE.Material;
                void material;
            }
        }
    }

    update(dt: number): void {
        this.float();
        this.twinkleWindows();

        const time = performance.now() * 0.001;

        this.decorations.forEach(decoration => {
            const data = decoration.userData;
            if (!data) return;

            switch (data.animationType) {
                case 'sparkle':
                    const sparkle = decoration as THREE.Mesh;
                    const material = sparkle.material as THREE.MeshBasicMaterial;
                    if (material) {
                        material.opacity = 0.3 + Math.sin(time * 3 + data.animationOffset) * 0.3 + 0.3;
                    }
                    if (data.basePos) {
                        sparkle.position.y = data.basePos.y + Math.sin(time + data.animationOffset) * 0.1;
                    }
                    break;

                case 'float':
                    decoration.position.y += Math.sin(time * data.floatSpeed + data.animationOffset) * 0.002;
                    decoration.rotation.y = Math.sin(time * 0.5 + data.animationOffset) * 0.1;
                    break;

                case 'flowerSway':
                    decoration.rotation.z = Math.sin(time * 0.5 + data.animationOffset) * 0.1;
                    break;

                case 'bellSwing':
                    decoration.rotation.z = Math.sin(time * 0.8 + data.animationOffset) * 0.15;
                    decoration.rotation.x = Math.cos(time * 0.6 + data.animationOffset) * 0.1;
                    break;

                case 'flagWave':
                    decoration.rotation.y = Math.sin(time * 2 + data.animationOffset) * 0.1;
                    break;
            }
        });

        this.flowers.forEach(flower => {
            const data = flower.userData;
            if (data && data.animationType === 'flowerSway') {
                flower.rotation.z = Math.sin(time * 0.7 + data.animationOffset) * 0.15;
                flower.rotation.x = Math.cos(time * 0.5 + data.animationOffset) * 0.1;
            }
        });

        this.glowLights.forEach((light, i) => {
            light.intensity = 0.4 + Math.sin(time * 2 + i) * 0.2;
        });
    }

    getPosition(): THREE.Vector3 {
        return this.group.position.clone();
    }

    setVisible(visible: boolean): void {
        this.group.visible = visible;
    }

    dispose(): void {
        disposeObject(this.group);
    }
}
