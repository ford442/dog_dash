import * as THREE from 'three';
import type { AudioPort, HudPort, JuicePort } from '../ports';

export type GrazeFeedbackPorts = {
    audio: AudioPort;
    hud: HudPort;
    juice: JuicePort;
};

export type GrazeHandlerOptions = {
    ports: GrazeFeedbackPorts;
    /** Player position for first-graze floating text (optional). */
    getPlayerPosition?: () => THREE.Vector3 | undefined;
    /** Fired on combo === 1 (e.g. friends flotilla cheer). */
    onFirstGraze?: (position: THREE.Vector3) => void;
};

/** Builds the `onGraze` callback for ObstacleSystem from narrow ports. */
export function createGrazeHandler(opts: GrazeHandlerOptions): (
    asteroid: THREE.Mesh,
    score: number,
    combo: number
) => void {
    const { ports, getPlayerPosition, onFirstGraze } = opts;
    return (asteroid, score, combo) => {
        ports.audio.playGraze?.(combo);
        ports.hud.addScore?.(score);
        ports.juice.showScoreText(score, asteroid.position.clone());
        ports.hud.showGrazeCombo?.(combo);
        if (combo === 1) {
            const playerPos = getPlayerPosition?.();
            if (playerPos) {
                ports.juice.showFloatingText('Near Miss!', playerPos, '#00ffff', 20);
                onFirstGraze?.(playerPos.clone());
            }
        }
    };
}
