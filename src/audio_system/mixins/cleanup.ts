import * as THREE from 'three';
import { bindMixin } from '../types';

export const cleanupMixin = bindMixin({
destroy() {
    this.stopGravityHum();
    this.stopEngine();
    this.stopHover();
    this.stopDrone();
    
    // Stop all music layers
    this.musicLayers.forEach(layer => {
        layer.oscillators.forEach(osc => {
            try {
                osc.stop();
                osc.disconnect();
            } catch (e) {}
        });
        if (layer.gain) {
            layer.gain.disconnect();
        }
    });
    this.musicLayers.clear();

    // Clear intervals
    if (this.musicInterval) {
        clearInterval(this.musicInterval);
    }
    if (this.magicMusicTimeout) {
        clearTimeout(this.magicMusicTimeout);
    }

    // Cleanup spatial sounds
    this.spatialSounds.forEach(sound => {
        if (sound.panner) sound.panner.disconnect();
    });
    this.spatialSounds.clear();

    // Close context
    if (this.ctx) {
        this.ctx.close();
        this.ctx = null;
    }
}
});
