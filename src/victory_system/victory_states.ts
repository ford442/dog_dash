import * as THREE from 'three';
import { AudioSystem } from '../audio_system';
import { JuiceManager, ShakeType } from '../juice_effects';
import { ParticleSystem } from '../particles';
import { CELEBRATION_COLORS } from './types';

export interface VictoryStateContext {
    camera: THREE.Camera;
    scene: THREE.Scene;
    audio: AudioSystem;
    juice: JuiceManager;
    particleSystem?: ParticleSystem;
    time: number;
    approachProgress: number;
    moonPosition: THREE.Vector3;
    landingZone: THREE.Vector3;
    originalCameraPos: THREE.Vector3;
    celebrationDuration: number;
    fireworkTimer: number;
    confettiTimer: number;
    messageTimer: number;
}

export interface VictoryCelebrationCallbacks {
    launchFirework: () => void;
    spawnConfettiBurst: () => void;
    spawnFloatingMessage: () => void;
    spawnThankYouNote: () => void;
}

export function updateApproach(ctx: VictoryStateContext, delta: number): void {
    ctx.approachProgress += delta * 0.3;
    ctx.approachProgress = Math.min(ctx.approachProgress, 1);

    const zoomProgress = Math.sin(ctx.approachProgress * Math.PI / 2);
    const targetZ = ctx.originalCameraPos.z - zoomProgress * 3;
    ctx.camera.position.z = THREE.MathUtils.lerp(ctx.camera.position.z, targetZ, delta * 2);

    if (ctx.time % 0.1 < delta && ctx.particleSystem) {
        const sparklePos = new THREE.Vector3(
            ctx.moonPosition.x - 10 + Math.random() * 5,
            ctx.moonPosition.y + (Math.random() - 0.5) * 10,
            (Math.random() - 0.5) * 5
        );
        ctx.particleSystem.emit(
            sparklePos,
            CELEBRATION_COLORS[Math.floor(Math.random() * CELEBRATION_COLORS.length)],
            3,
            2 + Math.random() * 2,
            0.3 + Math.random() * 0.3,
            1.0
        );
    }
}

export function updateLanding(ctx: VictoryStateContext, delta: number): void {
    const landingCameraPos = new THREE.Vector3(
        ctx.landingZone.x - 15,
        ctx.landingZone.y + 5,
        10
    );

    ctx.camera.position.lerp(landingCameraPos, delta * 2);
    ctx.camera.lookAt(ctx.landingZone);
}

export function createLandingEffects(ctx: VictoryStateContext): void {
    if (ctx.particleSystem) {
        for (let i = 0; i < 20; i++) {
            ctx.particleSystem.emit(
                ctx.landingZone.clone().add(new THREE.Vector3(
                    (Math.random() - 0.5) * 4,
                    Math.random() * 2,
                    (Math.random() - 0.5) * 4
                )),
                0xDDDDDD,
                1,
                1 + Math.random() * 2,
                0.5 + Math.random() * 0.5,
                2.0
            );
        }
    }

    ctx.juice.shakeScreen(ShakeType.MEDIUM, 0.5);

    ctx.audio.play('boing', 0.8);
    setTimeout(() => ctx.audio.play('magic_cast', 0.6), 200);
}

export function updateCelebration(
    ctx: VictoryStateContext,
    delta: number,
    callbacks: VictoryCelebrationCallbacks
): void {
    ctx.celebrationDuration += delta;

    ctx.fireworkTimer -= delta;
    if (ctx.fireworkTimer <= 0) {
        callbacks.launchFirework();
        ctx.fireworkTimer = 0.5 + Math.random() * 1.0;
    }

    ctx.confettiTimer -= delta;
    if (ctx.confettiTimer <= 0) {
        callbacks.spawnConfettiBurst();
        ctx.confettiTimer = 0.3;
    }

    ctx.messageTimer -= delta;
    if (ctx.messageTimer <= 0) {
        callbacks.spawnFloatingMessage();
        ctx.messageTimer = 1.5 + Math.random() * 1.0;
    }

    updateCelebrationCamera(ctx, delta);

    if (Math.random() < 0.01) {
        callbacks.spawnThankYouNote();
    }
}

export function createCelebrationEnvironment(ctx: VictoryStateContext): void {
    const celebrationLight = new THREE.PointLight(0xFFD700, 2, 50);
    celebrationLight.position.copy(ctx.landingZone);
    celebrationLight.position.y += 10;
    celebrationLight.name = 'celebrationLight';
    ctx.scene.add(celebrationLight);

    const colors = [0xFF69B4, 0x9370DB, 0x00CED1];
    colors.forEach((color, i) => {
        const light = new THREE.PointLight(color, 1, 30);
        const angle = (i / colors.length) * Math.PI * 2;
        light.position.set(
            ctx.landingZone.x + Math.cos(angle) * 15,
            ctx.landingZone.y + 5,
            Math.sin(angle) * 15
        );
        light.name = `celebrationRim${i}`;
        ctx.scene.add(light);
    });
}

export function updateCelebrationCamera(ctx: VictoryStateContext, delta: number): void {
    const orbitRadius = 20;
    const orbitSpeed = 0.3;
    const orbitY = 8;

    const angle = ctx.time * orbitSpeed;
    const targetPos = new THREE.Vector3(
        ctx.landingZone.x + Math.cos(angle) * orbitRadius,
        ctx.landingZone.y + orbitY + Math.sin(ctx.time * 0.5) * 2,
        Math.sin(angle) * orbitRadius
    );

    ctx.camera.position.lerp(targetPos, delta * 1);
    ctx.camera.lookAt(ctx.landingZone);
}
