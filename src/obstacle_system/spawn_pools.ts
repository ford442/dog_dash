import * as THREE from 'three';
import {
    type PatternConfig,
    type EnemyInstance,
    generatePatternPositions,
    getRandomPattern,
    getPatternName
} from '../enemy_patterns';
import { applyLevelVariant } from '../enemy_variants';
import {
    createCandyObstacleMaterial,
    emitSugarCrystalBurst,
    getCandyScoreBonus,
    pickCandyFlavor,
    pickCandyVariant,
    CANDY_FLAVOR_COLORS,
    type CandyAsteroidVariant,
    type CandyFlavor
} from '../candy_materials';
import { SHARED_ASTEROID_GEOMETRY, SHARED_CANDY_GEOMETRY } from './types';
import type { ObstacleSystemHost } from './host';
import { disposeObject } from '../utils';
import { getRunRngFork } from '../run_seed';

function obstacleRng() {
    return getRunRngFork('obstacles');
}

export function splitAsteroid(host: ObstacleSystemHost, asteroid: THREE.Mesh) {
        const wasCandy = !!asteroid.userData.isCandyAsteroid;
        const candyFlavor = asteroid.userData.candyFlavor as CandyFlavor | undefined;
        const candyVariant = asteroid.userData.candyVariant as CandyAsteroidVariant | undefined;

        if (wasCandy && candyFlavor) {
            emitSugarCrystalBurst(host.options.particleSystem as any, asteroid.position, candyFlavor, 1.2);
            const bonus = getCandyScoreBonus(candyVariant ?? 'gummy');
            host.options.onCandyAsteroidSplit?.(asteroid, bonus);
        } else {
            host.options.debrisSystem.emit(asteroid.position, 8, 5.0, asteroid.userData.radius);
        }

        const r = asteroid.userData.radius;

        // Waterfall splash interaction
        if (host.options.getCurrentLevel() === 6) {
            // Trigger actual water splash system
            host.options.waterfallSystem.triggerSplash(asteroid.position, 10 + r * 15);

            // Add extra cyan/white particle burst for big splashes
            if (r > 1.2) {
                host.options.particleSystem.emit(asteroid.position.clone(), 0x00ffff, 15, 8.0, 1.0, 1.5);
                host.options.particleSystem.emit(asteroid.position.clone(), 0xffffff, 10, 6.0, 0.8, 1.0);
            } else {
                host.options.particleSystem.emit(asteroid.position.clone(), 0x88ccff, 8, 5.0, 0.8, 1.0);
            }
        }

        if (r > 0.8) {
            const count = 2 + Math.floor(obstacleRng().random() * 2);
            for (let i = 0; i < count; i++) {
                const angle = (Math.PI * 2 * i) / count + (obstacleRng().random() - 0.5);
                const speed = 3.0 + obstacleRng().random() * 3.0;
                const zSpeed = (obstacleRng().random() - 0.5) * 8.0;
                const vel = new THREE.Vector3(Math.cos(angle) * speed, Math.sin(angle) * speed, zSpeed);
                if (wasCandy && obstacleRng().chance(0.35)) {
                    createCandyAsteroid(host, 
                        asteroid.position.x, asteroid.position.y, asteroid.position.z,
                        r * 0.5, vel, candyFlavor, candyVariant
                    );
                } else {
                    createAsteroid(host, asteroid.position.x, asteroid.position.y, asteroid.position.z, r * 0.5, vel);
                }
            }
        }

        host.scene.remove(asteroid);
        disposeObject(asteroid);
        const idx = host.obstacles.indexOf(asteroid);
        if (idx > -1) host.obstacles.splice(idx, 1);
    }
export function spawnPatternFormation(host: ObstacleSystemHost, playerX: number, playerY: number) {
        const difficulty = Math.min(3, 1 + playerX / 1000);
        const pattern = getRandomPattern(playerX, playerY, difficulty);
        
        console.log(`Spawning ${getPatternName(pattern.type)} formation with ${pattern.count} enemies`);
        
        const positions = generatePatternPositions(pattern);
        
        const config = host.options.getCurrentConfig();

        for (let i = 0; i < positions.length; i++) {
            const pos = positions[i];
            const size = 0.4 + obstacleRng().random() * 0.8;
            
            // Create different colored enemies for visual variety
            const hue = obstacleRng().random();
            const color = new THREE.Color().setHSL(hue, 0.7, 0.5);
            
            // Environment Tinting: Tint enemies based on the level configuration
            if (config?.enemyTintColor !== undefined) {
                const tintColor = new THREE.Color(config.enemyTintColor);
                color.lerp(tintColor, 0.6); // 60% environment color tint
            }

            const enemy = createPatternEnemy(host, 
                pos.x, pos.y, pos.z || 0, 
                size, 
                color.getHex(),
                pattern,
                i
            );
            
            host.patternEnemies.push(enemy);
        }
    }

export function createPatternEnemy(
    host: ObstacleSystemHost,
    x: number,
    y: number,
    z: number,
    size: number,
    color: number,
    pattern: PatternConfig,
    index: number
): EnemyInstance {
    const geo = new THREE.IcosahedronGeometry(size, 1);
    const positions = geo.attributes.position;
    for (let i = 0; i < positions.count; i++) {
        const noise = (obstacleRng().random() - 0.5) * 0.3;
        positions.setXYZ(
            i,
            positions.getX(i) * (1 + noise),
            positions.getY(i) * (1 + noise),
            positions.getZ(i) * (1 + noise)
        );
    }
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
        color: color,
        roughness: 0.4,
        metalness: 0.6,
        emissive: color,
        emissiveIntensity: 0.3,
        flatShading: true
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = {
        radius: size,
        isPatternEnemy: true,
        health: 1
    };

    applyLevelVariant(mesh, host.options.getCurrentLevel(), size, color);
    host.scene.add(mesh);
    host.obstacles.push(mesh);

    return {
        mesh,
        basePosition: new THREE.Vector3(x, y, z),
        patternOffset: index * 0.5,
        timeOffset: obstacleRng().random() * 100,
        speed: pattern.speed,
        pattern: pattern.type,
        amplitude: pattern.amplitude || 3,
        frequency: pattern.frequency || 1,
        phase: pattern.phase || 0,
        radius: pattern.radius || 3
    };
}

export function createAsteroid(host: ObstacleSystemHost, x: number, y: number, z = 0, size = 0, velocity: THREE.Vector3 | null = null) {
        const finalSize = (size > 0) ? size : (0.5 + obstacleRng().random() * 1.5);
        const scale = finalSize;

        const colorVariation = obstacleRng().random() * 0.2;
        const baseColor = 0x666666 + Math.floor(colorVariation * 0x222222);
        const mat = new THREE.MeshStandardMaterial({
            color: baseColor,
            roughness: 0.95,
            metalness: 0.05,
            flatShading: true
        });
        const asteroid = new THREE.Mesh(SHARED_ASTEROID_GEOMETRY.clone(), mat);
        asteroid.position.set(x, y, z);
        asteroid.scale.setScalar(scale);
        asteroid.rotation.set(obstacleRng().random() * Math.PI, obstacleRng().random() * Math.PI, obstacleRng().random() * Math.PI);
        asteroid.castShadow = true;
        asteroid.receiveShadow = true;
        asteroid.userData = {
            rotationSpeed: (obstacleRng().random() - 0.5) * 2,
            rotationSpeedY: (obstacleRng().random() - 0.5) * 1.5,
            rotationSpeedZ: (obstacleRng().random() - 0.5) * 1.8,
            radius: finalSize,
            baseScale: finalSize,
            velocity: velocity || new THREE.Vector3(0, 0, 0),
            squashTimer: 0,
            sparkleTimer: 1 + obstacleRng().random() * 3
        };
        applyLevelVariant(asteroid, host.options.getCurrentLevel(), finalSize);

        host.scene.add(asteroid);
        host.obstacles.push(asteroid);
        return asteroid;
    }

export function createCandyAsteroid(
    host: ObstacleSystemHost,
    x: number,
    y: number,
    z = 0,
    size = 0,
    velocity: THREE.Vector3 | null = null,
    flavor?: CandyFlavor,
    variant?: CandyAsteroidVariant
) {
    const finalSize = (size > 0) ? size : (0.5 + obstacleRng().random() * 1.5);
    const candyFlavor = flavor ?? pickCandyFlavor();
    const candyVariant = variant ?? pickCandyVariant();
    const isComet = candyVariant === 'comet';
    const scale = finalSize * (isComet ? 0.92 : 1.0);

    const mat = createCandyObstacleMaterial(candyFlavor, candyVariant);
    const asteroid = new THREE.Mesh(SHARED_CANDY_GEOMETRY, mat);
    asteroid.position.set(x, y, z);
    asteroid.scale.setScalar(scale);
    asteroid.rotation.set(obstacleRng().random() * Math.PI, obstacleRng().random() * Math.PI, obstacleRng().random() * Math.PI);
    asteroid.castShadow = true;
    asteroid.receiveShadow = true;
    asteroid.userData = {
        rotationSpeed: (obstacleRng().random() - 0.5) * 1.6,
        rotationSpeedY: (obstacleRng().random() - 0.5) * 1.2,
        rotationSpeedZ: (obstacleRng().random() - 0.5) * 1.4,
        radius: finalSize,
        baseScale: scale,
        velocity: velocity || new THREE.Vector3(0, 0, 0),
        isCandyAsteroid: true,
        candyFlavor,
        candyVariant,
        squashTimer: 0,
        sparkleTimer: 0.5 + obstacleRng().random() * 2
    };

    host.scene.add(asteroid);
    host.obstacles.push(asteroid);
    return asteroid;
}

export function triggerCandySquash(host: ObstacleSystemHost, asteroid: THREE.Mesh, intensity = 1) {
        if (!asteroid.userData.isCandyAsteroid) return;
        asteroid.userData.squashTimer = 0.35 * intensity;
        asteroid.userData.squashIntensity = intensity;
        const flavor = asteroid.userData.candyFlavor as CandyFlavor;
        emitSugarCrystalBurst(host.options.particleSystem as any, asteroid.position, flavor, intensity * 0.6);
    }
export function _updateCandyAsteroid(host: ObstacleSystemHost, obs: THREE.Mesh, delta: number) {
        const base = obs.userData.baseScale ?? obs.userData.radius ?? 1;

        if (obs.userData.squashTimer > 0) {
            obs.userData.squashTimer -= delta;
            const t = Math.max(0, obs.userData.squashTimer / 0.35);
            const wave = Math.sin((1 - t) * Math.PI);
            const intensity = obs.userData.squashIntensity ?? 1;
            const squash = 1 + wave * 0.35 * intensity;
            const stretch = 1 - wave * 0.18 * intensity;
            obs.scale.set(base * stretch, base * squash, base * squash);
        } else {
            const wobble = 1 + Math.sin(host.time * 3.5 + obs.id) * 0.03;
            obs.scale.setScalar(base * wobble);
        }

        obs.userData.sparkleTimer = (obs.userData.sparkleTimer ?? 2) - delta;
        if (obs.userData.sparkleTimer <= 0) {
            obs.userData.sparkleTimer = 1.5 + obstacleRng().random() * 3;
            const flavor = obs.userData.candyFlavor as CandyFlavor;
            const sparkleColor = (CANDY_FLAVOR_COLORS as Record<CandyFlavor, { sparkle: number }>)[flavor]?.sparkle ?? 0xffffff;
            host.options.particleSystem.emit(
                obs.position.clone().add(new THREE.Vector3(
                    (obstacleRng().random() - 0.5) * obs.userData.radius,
                    (obstacleRng().random() - 0.5) * obs.userData.radius,
                    (obstacleRng().random() - 0.5) * obs.userData.radius * 0.5
                )),
                sparkleColor,
                obs.userData.candyVariant === 'comet' ? 3 : 2,
                1.5,
                0.35,
                0.2
            );
        }
    }

export function createMineRobot(host: ObstacleSystemHost, x: number, y: number, z = 0) {
        const size = 0.7;
        const geo = new THREE.IcosahedronGeometry(size, 0);
        const mat = new THREE.MeshStandardMaterial({
            color: 0xaa2222,
            roughness: 0.5,
            metalness: 0.6,
            emissive: 0xff2200,
            emissiveIntensity: 0.6,
            flatShading: true
        });

        const mine = new THREE.Mesh(geo, mat);
        mine.position.set(x, y, z);
        mine.castShadow = true;
        mine.receiveShadow = true;

        // Cartoon eyes glaring toward the player (-X face)
        const eyeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });
        const pupils: THREE.Mesh[] = [];
        for (const side of [-1, 1]) {
            const eye = new THREE.Mesh(new THREE.SphereGeometry(size * 0.32, 10, 10), eyeMat);
            eye.position.set(-size * 0.75, size * 0.25, side * size * 0.35);
            mine.add(eye);

            const pupilMat = new THREE.MeshStandardMaterial({
                color: 0x110000,
                emissive: 0xff0000,
                emissiveIntensity: 0.5,
                roughness: 0.3
            });
            const pupil = new THREE.Mesh(new THREE.SphereGeometry(size * 0.14, 8, 8), pupilMat);
            pupil.position.set(-size * 0.28, 0, 0);
            eye.add(pupil);
            pupils.push(pupil);
        }

        // Furrowed "eyebrows" for a grumpy expression
        const browMat = new THREE.MeshStandardMaterial({ color: 0x551111, roughness: 0.8 });
        for (const side of [-1, 1]) {
            const brow = new THREE.Mesh(new THREE.BoxGeometry(size * 0.12, size * 0.55, size * 0.12), browMat);
            brow.position.set(-size * 0.78, size * 0.55, side * size * 0.35);
            brow.rotation.x = side * 0.4;
            mine.add(brow);
        }

        mine.userData = {
            rotationSpeed: 0,
            rotationSpeedY: (obstacleRng().random() - 0.5) * 0.3,
            rotationSpeedZ: 0,
            radius: size,
            velocity: new THREE.Vector3(0, 0, 0),
            isMineRobot: true,
            pupils
        };

        host.scene.add(mine);
        host.obstacles.push(mine);
        return mine;
    }
export function createBarnaclePod(host: ObstacleSystemHost, x: number, y: number, z = 0) {
        const size = 0.4 + obstacleRng().random() * 0.4;
        const geo = new THREE.DodecahedronGeometry(size, 0);
        const mat = new THREE.MeshStandardMaterial({
            color: 0x556677,
            roughness: 0.9,
            metalness: 0.1,
            emissive: 0x223344,
            emissiveIntensity: 0.4,
            flatShading: true
        });

        const barnacle = new THREE.Mesh(geo, mat);
        barnacle.position.set(x, y, z);
        barnacle.castShadow = true;
        barnacle.receiveShadow = true;
        barnacle.userData = {
            rotationSpeed: (obstacleRng().random() - 0.5) * 0.4,
            rotationSpeedY: (obstacleRng().random() - 0.5) * 0.4,
            rotationSpeedZ: (obstacleRng().random() - 0.5) * 0.4,
            radius: size,
            velocity: new THREE.Vector3(0, 0, 0),
            type: 'barnacle',
            hasMemoryFragment: obstacleRng().chance(0.3),
            hasWhaleLice: obstacleRng().chance(0.25)
        };

        host.scene.add(barnacle);
        host.obstacles.push(barnacle);
        return barnacle;
    }

