import * as THREE from 'three';
import type { DogAnimationHost } from './types';
import { HappyParticle } from './happy_particle';

export function twitchEars(host: DogAnimationHost, deltaTime: number): void {
        const twitchSpeed = 30;
        const twitchAmount = Math.sin(host.time * twitchSpeed) * 0.1;
        
        if (host.bones.leftEar || host.bones.earLeft) {
            const ear = host.bones.leftEar || host.bones.earLeft!;
            ear.rotation.x += twitchAmount * deltaTime;
        }
}

export function raisePaws(host: DogAnimationHost, raise: boolean): void {
        const targetRotation = raise ? -0.5 : 0;
        
        if (host.bones.leftFrontPaw) {
            const data = host.boneData.get('leftFrontPaw');
            if (data) {
                host.bones.leftFrontPaw.rotation.x = data.baseRotation.x + targetRotation;
            }
        }
        
        if (host.bones.rightFrontPaw) {
            const data = host.boneData.get('rightFrontPaw');
            if (data) {
                host.bones.rightFrontPaw.rotation.x = data.baseRotation.x + targetRotation;
            }
        }
}

export function boopNose(host: DogAnimationHost): void {
        if (!host.bones.nose) return;
        
        // Quick scale pulse on nose
        const originalScale = host.bones.nose.scale.clone();
        host.bones.nose.scale.multiplyScalar(1.3);
        
        // Animate back
        const animate = () => {
            if (host.bones.nose) {
                host.bones.nose.scale.lerp(originalScale, 0.2);
                if (host.bones.nose.scale.distanceTo(originalScale) > 0.01) {
                    requestAnimationFrame(animate);
                }
            }
        };
        animate();
}

export function spawnHappyParticles(host: DogAnimationHost): void {
        if (!host.scene || !host.accessoryGroup) return;
        
        const position = new THREE.Vector3();
        host.accessoryGroup.getWorldPosition(position);
        position.y += 0.5;
        
        for (let i = 0; i < 3; i++) {
            const offset = new THREE.Vector3(
                (Math.random() - 0.5) * 0.5,
                0,
                (Math.random() - 0.5) * 0.5
            );
            host.happyParticles.push(new HappyParticle(host.scene, position.clone().add(offset)));
        }
}
