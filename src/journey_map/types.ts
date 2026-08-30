/**
 * Journey map public types.
 */

export type JourneyMapMode = 'pause' | 'chapter' | 'victory';

export interface JourneyMapSnapshot {
    /** Level the player is currently on (1–6). */
    currentLevel: number;
    /** Levels whose chapter objectives are done (or already passed). */
    completedLevels: number[];
    /** Friends rescued this run (flotilla frees). */
    rescuedCount: number;
    /** Persistent flora / species discoveries. */
    discoveredSpeciesCount: number;
    /** Persistent bestiary catalog count. */
    catalogedCreaturesCount: number;
}

export interface ShowJourneyMapOptions {
    mode: JourneyMapMode;
    snapshot: JourneyMapSnapshot;
    /** Chapter just completed (highlight + dog line). */
    completedChapter?: number;
    onClose?: () => void;
    /** When true, auto-dismiss after a short beat (chapter toast). */
    autoCloseMs?: number;
}
