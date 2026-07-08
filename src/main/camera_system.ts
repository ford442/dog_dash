import * as THREE from 'three';
import { CONFIG } from '../game_config';
import { game } from '../game_runtime';
import { camera } from '../scene_context';
import { player } from '../player_loader';

// =============================================================================
// CAMERA FOLLOW - Dynamic with screen shake and movement response
// =============================================================================
let cameraShake = 0;
let cameraOffset = new THREE.Vector3();

export function triggerScreenShake(intensity: number, duration: number) {
    cameraShake = intensity;
    setTimeout(() => { cameraShake = 0; }, duration * 1000);
}

export function updateCamera(delta?: number) {
    // Don't update if player hasn't loaded yet
    if (!player) return;
    
    const d = delta || 0.016;
    
    // Dynamic camera positioning based on player movement
    const speedFactor = Math.abs(game.playerState.currentSpeedY) / CONFIG.player.maxSpeedY;
    const lookAheadX = 15 + speedFactor * 5; // Look further ahead when moving fast
    const lookAheadY = game.playerState.currentSpeedY * 0.3; // Lead vertical movement
    
    const targetX = player.position.x + lookAheadX;
    const targetY = Math.max(player.position.y + 2 + lookAheadY, CONFIG.cameraHeight);
    
    const isFallingFast = game.playerState.currentSpeedY < -5;
    const isBoosting = game.boostSystem.isBoosting();
    let targetDistance = CONFIG.cameraDistance;
    if (isFallingFast) targetDistance += 3;
    if (isBoosting) targetDistance += 4;

    // Smooth follow with different speeds for X, Y, and Z
    camera.position.x += (targetX - camera.position.x) * 0.06;
    camera.position.y += (targetY - camera.position.y) * 0.04;
    camera.position.z += (targetDistance - camera.position.z) * 0.03;

    // Subtle camera roll during barrel roll for extra immersion
    const isRolling = game.rollSystem.isRolling();
    if (isRolling) {
        const rollAngle = game.rollSystem.getRollAngle();
        camera.rotation.z += ((-rollAngle * 0.15) - camera.rotation.z) * 0.2;
    } else {
        camera.rotation.z += (0 - camera.rotation.z) * 0.05;
    }

    // Screen shake effect
    if (cameraShake > 0) {
        cameraOffset.x = (Math.random() - 0.5) * cameraShake;
        cameraOffset.y = (Math.random() - 0.5) * cameraShake;
        cameraOffset.z = (Math.random() - 0.5) * cameraShake * 0.5;
        camera.position.add(cameraOffset);
        cameraShake *= 0.9; // Decay
    }

    // Look ahead with slight tilt based on vertical speed
    const tiltAmount = -game.playerState.currentSpeedY * 0.02;
    camera.lookAt(
        player.position.x + 20,
        player.position.y + tiltAmount,
        0
    );
}
