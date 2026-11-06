import { renderer } from '../scene_context';
import { game } from '../game_runtime';

export function setupResizeHandler(): void {
    window.addEventListener('resize', () => {
        if (game?.camera) {
            game.camera.aspect = window.innerWidth / window.innerHeight;
            game.camera.updateProjectionMatrix();
        }
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}
