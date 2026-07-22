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
