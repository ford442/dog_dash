import { AudioSystem } from './AudioSystem';

// Singleton instance
let audioSystem: AudioSystem | null = null;

export function getAudioSystem(): AudioSystem {
    if (!audioSystem) {
        audioSystem = new AudioSystem();
    }
    return audioSystem;
}

export function initAudioOnInteraction() {
    const handler = () => {
        const audio = getAudioSystem();
        audio.resume();
        audio.startEngine();
        audio.startDrone(0.3);
        audio.startBackgroundMusic(); // Start new layered music system
        
        // Remove listeners after first interaction
        document.removeEventListener('click', handler);
        document.removeEventListener('keydown', handler);
    };
    
    document.addEventListener('click', handler);
    document.addEventListener('keydown', handler);
}
