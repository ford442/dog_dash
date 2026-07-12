import * as THREE from 'three';
import type { DogAnimationHost } from './types';

export function wagTail(host: DogAnimationHost, speed: number, intensity: number): void {
        host.tailWagSpeed = speed;
        host.tailWagIntensity = intensity;
        
        const wagTime = host.time * speed;
        
        if (host.bones.tail) {
            const data = host.boneData.get('tail');
            if (data) {
                host.bones.tail.rotation.y = data.baseRotation.y + Math.sin(wagTime) * intensity;
                host.bones.tail.rotation.z = data.baseRotation.z + Math.cos(wagTime * 0.7) * intensity * 0.3;
            }
        }
        
        // Tail tip wags faster for more natural look
        if (host.bones.tailTip) {
            const tipData = host.boneData.get('tailTip');
            if (tipData) {
                host.bones.tailTip.rotation.y = tipData.baseRotation.y + Math.sin(wagTime * 1.5) * intensity * 1.5;
            }
        }
}

export function perkEars(host: DogAnimationHost, amount: number): void {
        host.earPerkAmount = THREE.MathUtils.clamp(amount, -1, 1);
        
        const earRotation = host.earPerkAmount * 0.5;
        
        if (host.bones.leftEar || host.bones.earLeft) {
            const ear = host.bones.leftEar || host.bones.earLeft!;
            const data = host.boneData.get('leftEar') || host.boneData.get('earLeft');
            if (data) {
                ear.rotation.z = data.baseRotation.z + earRotation;
            }
        }
        
        if (host.bones.rightEar || host.bones.earRight) {
            const ear = host.bones.rightEar || host.bones.earRight!;
            const data = host.boneData.get('rightEar') || host.boneData.get('earRight');
            if (data) {
                ear.rotation.z = data.baseRotation.z - earRotation;
            }
        }
}

export function tiltHead(host: DogAnimationHost, angle: number): void {
        host.headTiltAngle = angle;
        
        if (host.bones.head || host.bones.pilotHead) {
            const head = host.bones.head || host.bones.pilotHead!;
            const data = host.boneData.get('head') || host.boneData.get('pilotHead');
            if (data) {
                head.rotation.z = data.baseRotation.z + angle;
            }
        }
}

export function bounceBody(host: DogAnimationHost, amount: number): void {
        host.bounceAmount = amount;
        
        if (host.bones.body || host.bones.pilotGroup) {
            const body = host.bones.body || host.bones.pilotGroup!;
            const data = host.boneData.get('body') || host.boneData.get('pilotGroup');
            if (data) {
                const bounce = Math.sin(host.time * 10) * amount * 0.1;
                body.position.y = data.basePosition.y + bounce;
            }
        }
}

