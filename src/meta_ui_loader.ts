/**
 * Dynamic loaders for post-title meta UI and victory/tutorial systems.
 * Keeps hub / journey / bestiary / crafting / victory / tutorial out of the
 * cold entry graph until first use or first gameplay click.
 */

import { scene, camera } from './scene_context';
import { game } from './game_runtime';
import type { HubMode } from './hub_screen';
import type { SaveManager } from './save_manager';

type JourneyMapModule = typeof import('./journey_map');
type HubIntegrationModule = typeof import('./main/hub_integration');
type BestiaryModule = typeof import('./bestiary');

let journeyMapMod: JourneyMapModule | null = null;
let hubIntegrationMod: HubIntegrationModule | null = null;
let bestiaryMod: BestiaryModule | null = null;
let victoryTutorialReady = false;

export async function ensureJourneyMap(): Promise<JourneyMapModule> {
    if (!journeyMapMod) {
        journeyMapMod = await import('./journey_map');
    }
    return journeyMapMod;
}

export async function ensureHubIntegration(): Promise<HubIntegrationModule> {
    if (!hubIntegrationMod) {
        hubIntegrationMod = await import('./main/hub_integration');
    }
    return hubIntegrationMod;
}

export async function ensureBestiaryUi(): Promise<BestiaryModule> {
    if (!bestiaryMod) {
        bestiaryMod = await import('./bestiary');
    }
    return bestiaryMod;
}

/** Open the Space Base hub (loads hub + crafting + bestiary UI chunk). */
export async function openHubScreenLazy(mode: HubMode): Promise<void> {
    const { openHubScreen } = await ensureHubIntegration();
    openHubScreen(mode);
}

/** Construct real VictorySystem + TutorialSystem before first gameplay frame. */
export async function ensureVictoryAndTutorial(): Promise<void> {
    if (victoryTutorialReady) return;

    const [{ VictorySystem }, { TutorialSystem, shouldShowTutorial }] = await Promise.all([
        import('./victory_system'),
        import('./tutorial_system')
    ]);

    const victorySystem = new VictorySystem(
        scene,
        camera,
        game.audioSystem,
        game.hudManager,
        game.juiceManager
    );
    const tutorialSystem = new TutorialSystem(
        scene,
        game.hudManager,
        game.audioSystem,
        game.dogController
    );

    if (shouldShowTutorial(game.saveManager as SaveManager)) {
        tutorialSystem.onComplete(() => {
            console.log('Tutorial complete! Starting game...');
        });
    }

    game.victorySystem = victorySystem;
    game.tutorialSystem = tutorialSystem;
    victoryTutorialReady = true;
}

export function isVictoryTutorialReady(): boolean {
    return victoryTutorialReady;
}

/** Prefetch meta UI after first click without blocking Level 1 start. */
export function prefetchMetaUi(): void {
    void ensureJourneyMap();
    void ensureHubIntegration();
    void ensureBestiaryUi();
}
