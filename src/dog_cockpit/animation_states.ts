import * as THREE from 'three';
import type { DogAnimationHost } from './types';

export function animateIdle(host: DogAnimationHost, deltaTime: number): void {
        const breathTime = host.time * 1.5;
        
        // Gentle body breathing
        if (host.bones.body || host.bones.pilotGroup) {
            const body = host.bones.body || host.bones.pilotGroup!;
            const data = host.boneData.get('body') || host.boneData.get('pilotGroup');
            if (data) {
                const breatheScale = 1 + Math.sin(breathTime) * 0.02;
                body.scale.set(
                    data.baseScale.x * breatheScale,
                    data.baseScale.y * (1 + Math.sin(breathTime) * 0.015),
                    data.baseScale.z * breatheScale
                );
            }
        }
        
        // Occasional ear twitch (every 3-5 seconds)
        const twitchCycle = (host.time % 4) / 4;
        if (twitchCycle > 0.9) {
            host.twitchEars(deltaTime);
        }
        
        // Slow gentle tail wag
        host.wagTail(2, 0.15);
        
        // Head tilt occasionally
        if (Math.random() < 0.001) {
            host.tiltHead((Math.random() - 0.5) * 0.3);
        }
}

export function animateThrust(host: DogAnimationHost, deltaTime: number, gameState?: any): void {
        // Fast tail wag
        host.wagTail(12, 0.4);
        
        // Body pushed back (g-force effect)
        if (host.bones.body || host.bones.pilotGroup) {
            const body = host.bones.body || host.bones.pilotGroup!;
            const data = host.boneData.get('body') || host.boneData.get('pilotGroup');
            if (data) {
                // Lean back
                const leanAmount = -0.3 * (1 - host.excitement * 0.3);
                body.rotation.x = THREE.MathUtils.lerp(body.rotation.x, data.baseRotation.x + leanAmount, 0.1);
            }
        }
        
        // Ears back (aerodynamic)
        host.perkEars(-0.2);
        
        // Excited expression
        host.happiness = Math.min(1, host.happiness + deltaTime * 0.5);
}

export function animateCollect(host: DogAnimationHost, deltaTime: number): void {
        // Ears perk up
        host.perkEars(0.6);
        
        // Happy tail wag
        host.wagTail(8, 0.3);
        
        // Head bob
        const bobTime = host.time * 10;
        if (host.bones.head || host.bones.pilotHead) {
            const head = host.bones.head || host.bones.pilotHead!;
            const data = host.boneData.get('head') || host.boneData.get('pilotHead');
            if (data) {
                head.position.y = data.basePosition.y + Math.abs(Math.sin(bobTime)) * 0.05;
            }
        }
        
        // Spawn happy particles
        if (Math.random() < 0.3) {
            host.spawnHappyParticles();
        }
        
        host.happiness = Math.min(1, host.happiness + 0.2);
}

export function animatePowerUp(host: DogAnimationHost, deltaTime: number): void {
        // Frenzied tail wag
        host.wagTail(20, 0.5);
        
        // Full body dance
        const danceTime = host.time * 8;
        if (host.bones.body || host.bones.pilotGroup) {
            const body = host.bones.body || host.bones.pilotGroup!;
            const data = host.boneData.get('body') || host.boneData.get('pilotGroup');
            if (data) {
                body.position.y = data.basePosition.y + Math.sin(danceTime * 2) * 0.08;
                body.rotation.z = Math.sin(danceTime) * 0.1;
            }
        }
        
        // Ears at maximum perk
        host.perkEars(0.8);
        
        // Paws up
        host.raisePaws(true);
        
        // Lots of particles
        if (Math.random() < 0.5) {
            host.spawnHappyParticles();
        }
        
        // Nose "boop" animation
        if (host.bones.nose && Math.random() < 0.1) {
            host.boopNose();
        }
        
        host.excitement = 1;
        host.happiness = 1;
}

export function animateHit(host: DogAnimationHost, deltaTime: number): void {
        // Ears droop down
        host.perkEars(-0.5);
        
        // Slow worried tail (or tucked)
        host.wagTail(1, 0.05);
        
        // Body cower slightly
        if (host.bones.body || host.bones.pilotGroup) {
            const body = host.bones.body || host.bones.pilotGroup!;
            const data = host.boneData.get('body') || host.boneData.get('pilotGroup');
            if (data) {
                body.position.y = THREE.MathUtils.lerp(body.position.y, data.basePosition.y - 0.1, 0.1);
                // Slight shake from fear
                body.position.x = data.basePosition.x + Math.sin(host.time * 20) * 0.01;
            }
        }
        
        // Head down
        if (host.bones.head || host.bones.pilotHead) {
            const head = host.bones.head || host.bones.pilotHead!;
            const data = host.boneData.get('head') || host.boneData.get('pilotHead');
            if (data) {
                head.rotation.x = THREE.MathUtils.lerp(head.rotation.x, data.baseRotation.x + 0.3, 0.1);
            }
        }
        
        host.worry = Math.min(1, host.worry + deltaTime * 2);
        host.happiness = Math.max(0, host.happiness - deltaTime);
}

export function animateVictory(host: DogAnimationHost, deltaTime: number): void {
        // Maximum tail wag
        host.wagTail(25, 0.6);
        
        // Paws up in celebration
        host.raisePaws(true);
        
        // Jump/bounce
        const jumpTime = host.time * 6;
        if (host.bones.body || host.bones.pilotGroup) {
            const body = host.bones.body || host.bones.pilotGroup!;
            const data = host.boneData.get('body') || host.boneData.get('pilotGroup');
            if (data) {
                body.position.y = data.basePosition.y + Math.abs(Math.sin(jumpTime)) * 0.15;
            }
        }
        
        // Head looking up happily
        if (host.bones.head || host.bones.pilotHead) {
            const head = host.bones.head || host.bones.pilotHead!;
            const data = host.boneData.get('head') || host.boneData.get('pilotHead');
            if (data) {
                head.rotation.x = THREE.MathUtils.lerp(head.rotation.x, data.baseRotation.x - 0.2, 0.1);
            }
        }
        
        // Confetti particles
        if (Math.random() < 0.4) {
            host.spawnHappyParticles();
        }
        
        host.excitement = 1;
        host.happiness = 1;
}

export function animateCurious(host: DogAnimationHost, deltaTime: number): void {
        // One ear up, one relaxed — curious asymmetry
        if (host.bones.leftEar) {
            const data = host.boneData.get('leftEar');
            if (data) {
                host.bones.leftEar.rotation.x = THREE.MathUtils.lerp(
                    host.bones.leftEar.rotation.x,
                    data.baseRotation.x - 0.5,
                    0.08
                );
            }
        }
        if (host.bones.rightEar) {
            const data = host.boneData.get('rightEar');
            if (data) {
                host.bones.rightEar.rotation.x = THREE.MathUtils.lerp(
                    host.bones.rightEar.rotation.x,
                    data.baseRotation.x + 0.15,
                    0.08
                );
            }
        }

        // Head tilts to one side
        if (host.bones.head || host.bones.pilotHead) {
            const head = host.bones.head || host.bones.pilotHead!;
            const data = host.boneData.get('head') || host.boneData.get('pilotHead');
            if (data) {
                head.rotation.z = THREE.MathUtils.lerp(head.rotation.z, data.baseRotation.z + 0.35, 0.08);
                head.rotation.x = THREE.MathUtils.lerp(head.rotation.x, data.baseRotation.x - 0.1, 0.08);
            }
        }

        // Slow, thoughtful tail wag
        host.wagTail(2.5, 0.2);
        host.happiness = Math.min(1, host.happiness + deltaTime * 0.3);
}

export function animateDelighted(host: DogAnimationHost, deltaTime: number): void {
        // Fast joyful tail wag (faster than collect, softer than power_up)
        host.wagTail(14, 0.45);

        // Both ears perked forward
        host.perkEars(0.7);

        // Happy bouncy head
        const bobTime = host.time * 9;
        if (host.bones.head || host.bones.pilotHead) {
            const head = host.bones.head || host.bones.pilotHead!;
            const data = host.boneData.get('head') || host.boneData.get('pilotHead');
            if (data) {
                head.position.y = data.basePosition.y + Math.abs(Math.sin(bobTime)) * 0.06;
                head.rotation.z = Math.sin(bobTime * 0.5) * 0.08;
            }
        }

        // Gentle body wiggle
        if (host.bones.body || host.bones.pilotGroup) {
            const body = host.bones.body || host.bones.pilotGroup!;
            const data = host.boneData.get('body') || host.boneData.get('pilotGroup');
            if (data) {
                body.rotation.z = Math.sin(host.time * 7) * 0.05;
            }
        }

        // Occasional happy sparkle
        if (Math.random() < 0.2) {
            host.spawnHappyParticles();
        }

        host.excitement = Math.min(1, host.excitement + deltaTime * 1.5);
        host.happiness = 1;
}

export function animateBark(host: DogAnimationHost, deltaTime: number): void {
        // Head thrust forward — vocal blast pose
        if (host.bones.head || host.bones.pilotHead) {
            const head = host.bones.head || host.bones.pilotHead!;
            const data = host.boneData.get('head') || host.boneData.get('pilotHead');
            if (data) {
                head.rotation.x = THREE.MathUtils.lerp(head.rotation.x, data.baseRotation.x + 0.35, 0.2);
                head.position.x = THREE.MathUtils.lerp(head.position.x, data.basePosition.x + 0.08, 0.2);
            }
        }

        // Ears perked, paws raised briefly
        host.perkEars(1.0);
        host.raisePaws(true);
        host.wagTail(16, 0.5);

        // Body bounce on bark
        host.bounceAmount = Math.max(host.bounceAmount, 0.15);
        if (host.bones.body || host.bones.pilotGroup) {
            const body = host.bones.body || host.bones.pilotGroup!;
            const data = host.boneData.get('body') || host.boneData.get('pilotGroup');
            if (data) {
                const pulse = Math.sin(host.time * 22) * 0.04;
                body.scale.y = data.baseScale.y * (1 + pulse);
            }
        }

        if (Math.random() < 0.35) {
            host.spawnHappyParticles();
        }

        host.excitement = 1;
        host.happiness = Math.min(1, host.happiness + deltaTime);
}
