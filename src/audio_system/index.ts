export type {
    SoundType,
    SoundConfig,
    MusicLayer,
    SpatialSound,
    MagicSequence,
    MusicState,
    AudioSystemHost,
    /** @deprecated Use AudioSystemHost */
    AudioSystemBase,
} from './types';
export { AudioSystem } from './AudioSystem';
export { getAudioSystem, initAudioOnInteraction } from './singleton';
export {
    CHAPTER_MUSIC,
    HUB_MUSIC_PROFILE,
    SCALE_STEPS,
    getChapterMusicProfile,
    scaleNote
} from './chapter_music';
export type {
    ChapterDynamics,
    ChapterGraph,
    ChapterMusicProfile,
    DangerLayerId,
    MusicLayerId,
    MusicScale
} from './chapter_music';
