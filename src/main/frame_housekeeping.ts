import { scene, camera, mainLight, renderer, touchControls } from '../scene_context';
import { player } from '../player_loader';
import { isGamePaused } from '../game_config';
import { game } from '../game_runtime';
import { getCollisionDebugTargets, RESOLUTION_RATIOS } from './render_helpers';
import { updateGpuLeakDetector } from '../gpu_leak_detector';
import * as THREE from 'three';

/**
 * Runs once per rendered frame on wall-clock `rawDelta`, independent of how
 * many (if any) fixed simulation steps run this frame. Everything here is
 * debug/perf instrumentation or input plumbing that must be measured against
 * real time — folding it into the sim accumulator would make the FPS-based
 * dynamic resolution logic read a constant ~60fps instead of the actual
 * render rate.
 *
 * Returns whether gameplay is currently paused (the caller should skip the
 * fixed-step accumulator entirely when true).
 */
export function updateFrameHousekeeping(rawDelta: number): boolean {
    // --- Debug System ---
    game.debugSystem.update(rawDelta);
    updateGpuLeakDetector(rawDelta);
    try {
        game.wireframeDebugHelper.update(scene, game.debugSystem.isEnabled('wireframe'));
        game.collisionDebugOverlay.update(
            game.debugSystem.isEnabled('collisionDebug'),
            getCollisionDebugTargets()
        );
    } catch (error) {
        if (!game.renderDebugWarningIssued) {
            game.renderDebugWarningIssued = true;
            console.warn('Renderer debug helpers skipped because a tracked object was malformed.', error);
        }
    }

    // --- FPS Tracking & Dynamic Pixel Ratio ---
    game.fpsFrameCount++;
    game.fpsElapsedTime += rawDelta;
    if (game.fpsElapsedTime >= 1.0) {
        const fps = game.fpsFrameCount / game.fpsElapsedTime;
        game.fpsFrameCount = 0;
        game.fpsElapsedTime = 0;

        if (fps < 45) {
            game.fpsLowDuration += 1.0;
            game.fpsHighDuration = 0;
            if (game.fpsLowDuration >= 3.0 && game.currentRatioIndex > 0) {
                game.currentRatioIndex--;
                game.currentPixelRatio = Math.min(2, window.devicePixelRatio * RESOLUTION_RATIOS[game.currentRatioIndex]);
                renderer.setPixelRatio(game.currentPixelRatio);
                console.log(`Performance low — dropping resolution to ${Math.round(RESOLUTION_RATIOS[game.currentRatioIndex] * 100)}%`);
            }
        } else if (fps > 55) {
            game.fpsHighDuration += 1.0;
            game.fpsLowDuration = 0;
            if (game.fpsHighDuration >= 5.0 && game.currentRatioIndex < RESOLUTION_RATIOS.length - 1) {
                game.currentRatioIndex++;
                game.currentPixelRatio = Math.min(2, window.devicePixelRatio * RESOLUTION_RATIOS[game.currentRatioIndex]);
                renderer.setPixelRatio(game.currentPixelRatio);
                console.log(`Performance recovered — restoring resolution to ${Math.round(RESOLUTION_RATIOS[game.currentRatioIndex] * 100)}%`);
            }
        } else {
            game.fpsLowDuration = 0;
            game.fpsHighDuration = 0;
        }

        if (fps < 45 && game.objectDensityMultiplier > 0.25) {
            game.objectDensityMultiplier = Math.max(0.25, game.objectDensityMultiplier - 0.25);
            game.levelManager.setObjectDensityMultiplier(game.objectDensityMultiplier);
            console.log(`Performance low — reducing object density to ${Math.round(game.objectDensityMultiplier * 100)}%`);
        } else if (fps > 55 && game.objectDensityMultiplier < 1.0) {
            game.objectDensityMultiplier = Math.min(1.0, game.objectDensityMultiplier + 0.25);
            game.levelManager.setObjectDensityMultiplier(game.objectDensityMultiplier);
            console.log(`Performance recovered — restoring object density to ${Math.round(game.objectDensityMultiplier * 100)}%`);
        }
    }

    // --- Debug Shadow Toggle ---
    const shadowsOn = game.debugSystem.isEnabled('shadows');
    if (mainLight.castShadow !== shadowsOn) {
        mainLight.castShadow = shadowsOn;
        renderer.shadowMap.enabled = shadowsOn;
    }

    if (isGamePaused) {
        return true;
    }

    // Update rocket position for touch controls (follow finger mode)
    if (touchControls && player) {
        // Convert player position to screen space for follow finger mode
        const vector = player.position.clone();
        vector.project(camera);
        const screenX = (vector.x * 0.5 + 0.5) * window.innerWidth;
        const screenY = (-vector.y * 0.5 + 0.5) * window.innerHeight;

        touchControls.setRocketPosition(
            player.position,
            new THREE.Vector2(screenX, screenY)
        );
    }

    return false;
}
