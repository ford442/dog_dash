import * as THREE from 'three';
import { canvas, camera } from './scene_context';
import { player } from './player_loader';
import { playerState } from './game_config';
import { createUI, setupKeyboardControls, updateHealthDisplay } from './ui_controls';
import { createHeatBar, createBoostDisplay, createRollDisplay, createCoresDisplay } from './ui_factory';
import { levelManager } from './level_manager';
import { sporeClouds } from './environment';

// =============================================================================
// INPUT SYSTEM
// =============================================================================

export { keys } from './ui_controls';

// --- Boost System ---
export let lastSpaceTapTime = 0;
export const DOUBLE_TAP_THRESHOLD = 300; // ms
export let wantsBoost = false;
export let wasTouchBoosting = false;

// --- Roll System ---
export let lastLeftTapTime = 0;
export let lastRightTapTime = 0;
export let wantsRoll = false;
export let wasTouchRolling = false;

// Instructions click handler
export const instructions = document.getElementById('instructions');

// Double-tap Space for boost
window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
        const now = performance.now();
        if (now - lastSpaceTapTime < DOUBLE_TAP_THRESHOLD) {
            wantsBoost = true;
        }
        lastSpaceTapTime = now;
    }
});

// Double-tap A / Left Arrow or D / Right Arrow for barrel roll
window.addEventListener('keydown', (e) => {
    const now = performance.now();
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') {
        if (now - lastLeftTapTime < DOUBLE_TAP_THRESHOLD) {
            wantsRoll = true;
        }
        lastLeftTapTime = now;
    }
    if (e.code === 'KeyD' || e.code === 'ArrowRight') {
        if (now - lastRightTapTime < DOUBLE_TAP_THRESHOLD) {
            wantsRoll = true;
        }
        lastRightTapTime = now;
    }
});

// Canvas click handler (spore clouds, wish lanterns)
export function setupCanvasClickHandler(
    particleSystem: any,
    friendsManager: any,
    onGameStart: () => void
) {
    canvas.addEventListener('click', (event) => {
        if (!onGameStart) return;

        // Get mouse position in normalized device coordinates
        const rect = canvas.getBoundingClientRect();
        const mouse = new THREE.Vector2();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        // Create raycaster
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, camera);

        // Check intersection with spore clouds
        sporeClouds.forEach(cloud => {
            if (!cloud.active) return;

            const intersects = raycaster.intersectObjects(cloud.spores, false);
            if (intersects.length > 0) {
                const hitPoint = intersects[0].point;

                if (intersects[0].instanceId !== undefined) {
                     const triggered = cloud.triggerChainReaction(hitPoint);
                     if (triggered > 0) {
                        particleSystem.emit(hitPoint, 0x88ff88, 20, 8.0, 1.0, 2.0);
                     }
                } else {
                     const triggered = cloud.triggerChainReaction(hitPoint);
                     if (triggered > 0) {
                        particleSystem.emit(hitPoint, 0x88ff88, 20, 8.0, 1.0, 2.0);
                     }
                }
            }
        });
        
        // Check intersection with wish lanterns (click to pop)
        friendsManager.lanterns.forEach((lantern: any) => {
            if (lantern.isPopped) return;
            
            const intersects = raycaster.intersectObject(lantern.group, true);
            if (intersects.length > 0) {
                friendsManager.popLantern(lantern);
                // Bonus for manual pop
                playerState.cores += 5;
            }
        });
    });
}
