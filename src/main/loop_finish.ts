import { player } from '../player_loader';
import { playerState } from '../game_config';
import { game } from '../game_runtime';
import { keys, updateDistanceDisplay } from '../ui_controls';
import { VictoryState } from '../victory_system';
import { DogAnimationState } from '../dog_cockpit';
import { updateHeatBar, updateCoresDisplay, updateBoostDisplay, updateRollDisplay, updateBarkDisplay, updateTetherDisplay, updateGrenadeDisplay } from './hud_displays';
import { renderGameFrame } from './render_helpers';

export function updateLoopFinish(_time: number): void {
        
        // Update distance display
        updateDistanceDisplay(playerState, player);
        
        // Update UI elements
        updateHeatBar();
        updateCoresDisplay();
        updateBoostDisplay();
        updateRollDisplay();
        updateBarkDisplay();
        updateTetherDisplay();
        updateGrenadeDisplay();
        
        // Check if player reached the moon (or defeated boss in level 1)
        if (player && player.position.x >= playerState.distanceToMoon - 10 && !playerState.hasWon && !playerState.bossActive) {
            // If we got here without beating the boss, spawn it now
            if (playerState.level === 1 && game.bossManager.getBoss() === null) {
                // Trigger boss
            } else {
                playerState.hasWon = true;
                game.saveManager.updateHighScore(Math.floor(player.position.x));
                game.saveManager.addCores(playerState.cores);

                if (game.victorySystem.getState() === VictoryState.NONE) {
                    game.victorySystem.startApproach(game.moon.position);
                }

                game.audioSystem.play('boss_defeat');
                game.dogController.triggerAnimation(DogAnimationState.VICTORY, 5.0);
                game.hudManager.checkAndSaveHighScore();
            }
        }
    
    
}
