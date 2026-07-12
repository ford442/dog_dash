import * as THREE from 'three';
import { AudioSystem } from '../audio_system';
import { JuiceManager } from '../juice_effects';
import { HUDManager, GameStats } from '../hud_system';
import { ParticleSystem } from '../particles';
import {
    VictoryState,
    FireworkParticle,
    ConfettiPiece,
    StarRainParticle,
    FloatingText,
    ThankYouNote,
} from './types';
import {
    type VictoryStateContext,
    updateApproach,
    updateLanding,
    createLandingEffects,
    updateCelebration,
    createCelebrationEnvironment,
} from './victory_states';
import {
    type VictoryEffectsContext,
    startFireworksDisplay,
    launchFirework,
    updateFireworks,
    startConfettiRain,
    spawnConfettiBurst,
    updateConfetti,
    startStarRain,
    updateStarRain,
    startRainbowBeams,
    updateRainbowBeams,
    showVictoryMessages,
    spawnFloatingMessage,
    updateFloatingTexts,
    spawnThankYouNote,
    updateThankYouNotes,
    clearVictoryEffects,
} from './victory_effects';

// =============================================================================
// VICTORY SYSTEM CLASS
// =============================================================================

export class VictorySystem {
    private scene: THREE.Scene;
    private camera: THREE.Camera;
    private audio: AudioSystem;
    private hud: HUDManager;
    private juice: JuiceManager;
    private particleSystem?: ParticleSystem;
    
    // State
    private state: VictoryState = VictoryState.NONE;
    private time: number = 0;
    private approachProgress: number = 0;
    
    // Moon and landing
    private moonPosition: THREE.Vector3 = new THREE.Vector3();
    private landingZone: THREE.Vector3 = new THREE.Vector3();
    private moonGroup?: THREE.Group;
    
    // Effects containers
    private fireworks: FireworkParticle[] = [];
    private confetti: ConfettiPiece[] = [];
    private starRain: StarRainParticle[] = [];
    private floatingTexts: FloatingText[] = [];
    private thankYouNotes: ThankYouNote[] = [];
    private rainbowBeams: THREE.Mesh[] = [];
    
    // 3D Objects for celebration
    private celebrationGroup: THREE.Group;
    private fireworksGroup: THREE.Group;
    private confettiGroup: THREE.Group;
    private starRainGroup: THREE.Group;
    
    // UI Elements
    private victoryOverlay?: HTMLDivElement;
    private textContainer?: HTMLDivElement;
    
    // Timers
    private fireworkTimer: number = 0;
    private confettiTimer: number = 0;
    private messageTimer: number = 0;
    private celebrationDuration: number = 0;
    
    // Camera control
    private originalCameraPos: THREE.Vector3 = new THREE.Vector3();
    private originalCameraTarget: THREE.Vector3 = new THREE.Vector3();
    private cameraTargetPos: THREE.Vector3 = new THREE.Vector3();
    
    // Callbacks
    private onComplete?: () => void;
    private onReset?: () => void;
    
    constructor(
        scene: THREE.Scene,
        camera: THREE.Camera,
        audio: AudioSystem,
        hud: HUDManager,
        juice: JuiceManager,
        particleSystem?: ParticleSystem
    ) {
        this.scene = scene;
        this.camera = camera;
        this.audio = audio;
        this.hud = hud;
        this.juice = juice;
        this.particleSystem = particleSystem;
        
        this.celebrationGroup = new THREE.Group();
        this.fireworksGroup = new THREE.Group();
        this.confettiGroup = new THREE.Group();
        this.starRainGroup = new THREE.Group();
        
        this.celebrationGroup.add(this.fireworksGroup);
        this.celebrationGroup.add(this.confettiGroup);
        this.celebrationGroup.add(this.starRainGroup);
        
        this.scene.add(this.celebrationGroup);
        
        this.createTextContainer();
        
        this.originalCameraPos.copy(camera.position);
    }

    private getStateContext(): VictoryStateContext {
        return {
            camera: this.camera,
            scene: this.scene,
            audio: this.audio,
            juice: this.juice,
            particleSystem: this.particleSystem,
            time: this.time,
            approachProgress: this.approachProgress,
            moonPosition: this.moonPosition,
            landingZone: this.landingZone,
            originalCameraPos: this.originalCameraPos,
            celebrationDuration: this.celebrationDuration,
            fireworkTimer: this.fireworkTimer,
            confettiTimer: this.confettiTimer,
            messageTimer: this.messageTimer,
        };
    }

    private getEffectsContext(): VictoryEffectsContext {
        return {
            scene: this.scene,
            camera: this.camera,
            audio: this.audio,
            time: this.time,
            landingZone: this.landingZone,
            celebrationGroup: this.celebrationGroup,
            fireworksGroup: this.fireworksGroup,
            confettiGroup: this.confettiGroup,
            starRainGroup: this.starRainGroup,
            confetti: this.confetti,
            rainbowBeams: this.rainbowBeams,
            floatingTexts: this.floatingTexts,
            thankYouNotes: this.thankYouNotes,
            textContainer: this.textContainer,
        };
    }

    private syncStateFromContext(ctx: VictoryStateContext): void {
        this.approachProgress = ctx.approachProgress;
        this.celebrationDuration = ctx.celebrationDuration;
        this.fireworkTimer = ctx.fireworkTimer;
        this.confettiTimer = ctx.confettiTimer;
        this.messageTimer = ctx.messageTimer;
    }
    
    // =====================================================================
    // PUBLIC API
    // =====================================================================
    
    startApproach(moonPosition: THREE.Vector3, moonGroup?: THREE.Group): void {
        if (this.state !== VictoryState.NONE) return;
        
        this.state = VictoryState.APPROACHING;
        this.moonPosition.copy(moonPosition);
        this.moonGroup = moonGroup;
        this.approachProgress = 0;
        this.time = 0;
        
        this.landingZone.copy(moonPosition);
        this.landingZone.y -= 8;
        
        this.originalCameraPos.copy(this.camera.position);
        
        this.playVictoryMusic();
        
        console.log('🌙 Victory approach started!');
    }
    
    land(): void {
        if (this.state !== VictoryState.APPROACHING) return;
        
        this.state = VictoryState.LANDING;
        this.time = 0;
        
        createLandingEffects(this.getStateContext());
        
        setTimeout(() => {
            this.celebrate();
        }, 2000);
        
        console.log('🚀 Landed on the moon!');
    }
    
    celebrate(): void {
        this.state = VictoryState.CELEBRATING;
        this.time = 0;
        this.celebrationDuration = 0;
        
        createCelebrationEnvironment(this.getStateContext());
        
        this.fireworkTimer = 0;
        const effectsCtx = this.getEffectsContext();
        startFireworksDisplay(effectsCtx);
        startConfettiRain(effectsCtx);
        startStarRain(effectsCtx);
        startRainbowBeams(effectsCtx);
        
        this.showVictoryUI();
        this.playCelebrationSounds();
        showVictoryMessages(effectsCtx, () => this.getRandomColor());
        
        console.log('🎉 VICTORY CELEBRATION! 🎉');
    }
    
    update(delta: number): void {
        this.time += delta;
        
        const stateCtx = this.getStateContext();
        const effectsCtx = this.getEffectsContext();
        
        switch (this.state) {
            case VictoryState.APPROACHING:
                updateApproach(stateCtx, delta);
                break;
            case VictoryState.LANDING:
                updateLanding(stateCtx, delta);
                break;
            case VictoryState.CELEBRATING:
                updateCelebration(stateCtx, delta, {
                    launchFirework: () => launchFirework(effectsCtx),
                    spawnConfettiBurst: () => spawnConfettiBurst(effectsCtx),
                    spawnFloatingMessage: () => spawnFloatingMessage(effectsCtx, () => this.getRandomColor()),
                    spawnThankYouNote: () => spawnThankYouNote(effectsCtx),
                });
                break;
        }
        
        this.syncStateFromContext(stateCtx);
        
        updateFireworks(effectsCtx, delta);
        updateConfetti(effectsCtx, delta);
        updateStarRain(effectsCtx, delta);
        updateFloatingTexts(effectsCtx, delta);
        updateThankYouNotes(effectsCtx, delta);
        updateRainbowBeams(effectsCtx, delta);
    }
    
    reset(): void {
        this.state = VictoryState.NONE;
        this.time = 0;
        this.approachProgress = 0;
        
        this.clearAllEffects();
        this.removeVictoryUI();
        
        this.camera.position.copy(this.originalCameraPos);
        
        console.log('Victory system reset');
    }
    
    getState(): VictoryState {
        return this.state;
    }
    
    isActive(): boolean {
        return this.state !== VictoryState.NONE;
    }
    
    setCallbacks(onComplete?: () => void, onReset?: () => void): void {
        this.onComplete = onComplete;
        this.onReset = onReset;
    }
    
    // =====================================================================
    // VICTORY UI
    // =====================================================================
    
    private showVictoryUI(): void {
        this.victoryOverlay = document.createElement('div');
        this.victoryOverlay.id = 'victory-overlay';
        this.victoryOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            display: flex;
            flex-direction: column;
            justify-content: flex-end;
            align-items: center;
            padding-bottom: 10%;
            background: linear-gradient(to top, rgba(255,215,0,0.3) 0%, transparent 50%);
            z-index: 1000;
            pointer-events: none;
        `;
        
        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = `
            display: flex;
            gap: 20px;
            pointer-events: auto;
        `;
        
        const playAgainBtn = this.createVictoryButton('🎮 Play Again', '#4CAF50');
        playAgainBtn.onclick = () => {
            this.audio.play('ui_click');
            if (this.onReset) {
                this.onReset();
            } else {
                location.reload();
            }
        };
        
        const menuBtn = this.createVictoryButton('🏠 Back to Menu', '#2196F3');
        menuBtn.onclick = () => {
            this.audio.play('ui_click');
            location.reload();
        };
        
        buttonContainer.appendChild(playAgainBtn);
        buttonContainer.appendChild(menuBtn);
        this.victoryOverlay.appendChild(buttonContainer);
        
        document.body.appendChild(this.victoryOverlay);
        
        const stats: GameStats = {
            score: this.hud.getScore ? this.hud.getScore() : 1000,
            distance: Math.floor(this.landingZone.x),
            orbsCollected: 50,
            powerUpsUsed: 5
        };
        this.hud.showVictoryScreen(stats);
    }
    
    private createVictoryButton(text: string, color: string): HTMLButtonElement {
        const btn = document.createElement('button');
        btn.textContent = text;
        btn.style.cssText = `
            padding: 20px 40px;
            font-size: 24px;
            font-family: 'Segoe UI', 'Comic Sans MS', cursive, sans-serif;
            font-weight: bold;
            color: white;
            background: ${color};
            border: none;
            border-radius: 50px;
            cursor: pointer;
            box-shadow: 0 6px 0 ${this.darkenColor(color, 20)}, 0 10px 20px rgba(0,0,0,0.3);
            transition: transform 0.1s, box-shadow 0.1s;
            animation: victory-button-bounce 2s ease-in-out infinite;
        `;
        
        btn.addEventListener('mousedown', () => {
            btn.style.transform = 'translateY(4px)';
            btn.style.boxShadow = `0 2px 0 ${this.darkenColor(color, 20)}, 0 4px 10px rgba(0,0,0,0.3)`;
        });
        
        btn.addEventListener('mouseup', () => {
            btn.style.transform = 'translateY(0)';
            btn.style.boxShadow = `0 6px 0 ${this.darkenColor(color, 20)}, 0 10px 20px rgba(0,0,0,0.3)`;
        });
        
        btn.addEventListener('mouseenter', () => {
            this.audio.play('giggle', 0.3);
        });
        
        return btn;
    }
    
    private removeVictoryUI(): void {
        if (this.victoryOverlay) {
            this.victoryOverlay.remove();
            this.victoryOverlay = undefined;
        }
        
        this.floatingTexts.forEach(text => text.element.remove());
        this.floatingTexts = [];
    }
    
    // =====================================================================
    // AUDIO
    // =====================================================================
    
    private playVictoryMusic(): void {
        this.audio.playMagicSequence('spell_complete');
        
        setTimeout(() => {
            this.audio.playMagicSound('happy');
        }, 800);
        
        setTimeout(() => {
            this.audio.play('magic_cast', 0.7);
        }, 1500);
    }
    
    private playCelebrationSounds(): void {
        const playRandomSound = () => {
            if (this.state !== VictoryState.CELEBRATING) return;
            
            const sounds: Array<'twinkle' | 'sparkle' | 'heart_pop' | 'giggle'> = 
                ['twinkle', 'sparkle', 'heart_pop', 'giggle'];
            const sound = sounds[Math.floor(Math.random() * sounds.length)];
            this.audio.play(sound, 0.4);
            
            setTimeout(playRandomSound, 500 + Math.random() * 1500);
        };
        
        playRandomSound();
    }
    
    // =====================================================================
    // UTILITY
    // =====================================================================
    
    private createTextContainer(): void {
        this.textContainer = document.createElement('div');
        this.textContainer.id = 'victory-text-container';
        this.textContainer.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 999;
            overflow: hidden;
        `;
        document.body.appendChild(this.textContainer);
    }
    
    private clearAllEffects(): void {
        this.fireworks = [];
        this.starRain = [];
        
        clearVictoryEffects(this.getEffectsContext());
        
        const lightsToRemove: string[] = [];
        this.scene.traverse((child) => {
            if (child.name.startsWith('celebration')) {
                lightsToRemove.push(child.name);
            }
        });
        lightsToRemove.forEach(name => {
            const obj = this.scene.getObjectByName(name);
            if (obj) this.scene.remove(obj);
        });
        
        if (this.textContainer) {
            this.textContainer.remove();
            this.textContainer = undefined;
        }
    }
    
    private getRandomColor(): string {
        const colors = ['gold', 'pink', 'purple', 'blue', 'green', 'rainbow'];
        return colors[Math.floor(Math.random() * colors.length)];
    }
    
    private darkenColor(color: string, percent: number): string {
        const num = parseInt(color.replace('#', ''), 16);
        const amt = Math.round(2.55 * percent);
        const R = Math.max((num >> 16) - amt, 0);
        const G = Math.max((num >> 8 & 0x00FF) - amt, 0);
        const B = Math.max((num & 0x0000FF) - amt, 0);
        return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
    }
    
    dispose(): void {
        this.reset();
        this.scene.remove(this.celebrationGroup);
    }
}
