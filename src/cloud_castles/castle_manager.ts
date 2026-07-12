/**
 * Castle background manager — spawning, parallax, and cleanup
 */

import * as THREE from 'three';
import { CloudCastle, ShootingStarSystem } from './cloud_castle';

export class CastleBackgroundManager {
    scene: THREE.Scene;
    castles: CloudCastle[] = [];
    shootingStars: ShootingStarSystem;

    layerConfig = {
        background: { speed: 0.02, scale: 1.5, yRange: [8, 15], z: -40 },
        midground: { speed: 0.05, scale: 1.0, yRange: [5, 12], z: -25 },
        foreground: { speed: 0.1, scale: 0.6, yRange: [2, 8], z: -15 }
    };

    parallaxSpeed: number = 1.0;
    lastPlayerX: number = 0;
    spawnRange: number = 300;
    cleanupRange: number = 400;

    constructor(scene: THREE.Scene) {
        this.scene = scene;
        this.shootingStars = new ShootingStarSystem(scene);
    }

    generateCastleField(count: number, xMin: number, xMax: number): void {
        const range = xMax - xMin;

        for (let i = 0; i < count; i++) {
            const t = i / Math.max(1, count - 1);
            const x = xMin + t * range + (Math.random() - 0.5) * 50;

            const layerType = Math.random();
            let layer: keyof typeof this.layerConfig;
            if (layerType < 0.3) layer = 'background';
            else if (layerType < 0.7) layer = 'midground';
            else layer = 'foreground';

            this.spawnCastleAtLayer(x, layer);
        }
    }

    spawnCastle(x: number, scale?: number): CloudCastle {
        return this.spawnCastleAtLayer(x, 'midground', scale);
    }

    private spawnCastleAtLayer(
        x: number,
        layer: keyof typeof this.layerConfig,
        customScale?: number
    ): CloudCastle {
        const config = this.layerConfig[layer];

        const y = config.yRange[0] + Math.random() * (config.yRange[1] - config.yRange[0]);
        const position = new THREE.Vector3(x, y, config.z + (Math.random() - 0.5) * 10);

        const scale = customScale ?? config.scale * (0.8 + Math.random() * 0.4);

        const castle = new CloudCastle(position, scale);
        castle.group.userData = {
            layer: layer,
            baseX: x,
            parallaxSpeed: config.speed
        };

        this.scene.add(castle.group);
        this.castles.push(castle);

        return castle;
    }

    update(dt: number, playerX: number): void {
        this.lastPlayerX = playerX;

        this.castles.forEach(castle => {
            const layer = castle.group.userData.layer as keyof typeof this.layerConfig;
            const baseX = castle.group.userData.baseX as number;
            const speed = castle.group.userData.parallaxSpeed as number;

            const parallaxOffset = (playerX - baseX) * speed * this.parallaxSpeed;
            castle.group.position.x = baseX - parallaxOffset;

            castle.update(dt);
        });

        this.shootingStars.update(dt, playerX);

        this.maintainCastles(playerX);
        this.cleanupFarCastles(playerX);
    }

    private maintainCastles(playerX: number): void {
        const aheadCastles = this.castles.filter(c =>
            c.group.userData.baseX > playerX &&
            c.group.userData.baseX < playerX + this.spawnRange
        );

        if (aheadCastles.length < 3) {
            const spawnX = playerX + this.spawnRange * 0.8 + Math.random() * 50;

            const layers: (keyof typeof this.layerConfig)[] = ['background', 'midground', 'foreground'];
            const layer = layers[Math.floor(Math.random() * layers.length)];

            this.spawnCastleAtLayer(spawnX, layer);
        }

        const behindBgCastles = this.castles.filter(c =>
            c.group.userData.layer === 'background' &&
            c.group.userData.baseX < playerX &&
            c.group.userData.baseX > playerX - this.spawnRange
        );

        if (behindBgCastles.length < 2) {
            const spawnX = playerX - this.spawnRange * 0.8 - Math.random() * 50;
            this.spawnCastleAtLayer(spawnX, 'background');
        }
    }

    cleanupFarCastles(playerX: number): void {
        const toRemove: CloudCastle[] = [];

        this.castles.forEach(castle => {
            const distance = Math.abs(castle.group.position.x - playerX);

            if (distance > this.cleanupRange) {
                toRemove.push(castle);
            }
        });

        toRemove.forEach(castle => {
            this.scene.remove(castle.group);
            castle.dispose();
            const index = this.castles.indexOf(castle);
            if (index > -1) {
                this.castles.splice(index, 1);
            }
        });
    }

    setParallaxSpeed(speed: number): void {
        this.parallaxSpeed = speed;
    }

    getCastleCount(): number {
        return this.castles.length;
    }

    clear(): void {
        this.castles.forEach(castle => {
            this.scene.remove(castle.group);
            castle.dispose();
        });
        this.castles = [];
    }
}
