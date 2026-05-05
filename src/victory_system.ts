/**
 * Victory System for Dog Dash
 * The MOST satisfying victory celebration for a 7-year-old girl! 🏆✨🌙
 * 
 * Features:
 * - Moon approach sequence with gradual slow-down
 * - Magical landing with dog victory dance
 * - Fireworks, confetti, and star rain
 * - Golden celebration atmosphere
 * - Floating thank-you notes from moon palace
 * - Play Again / Back to Menu buttons
 */

import * as THREE from 'three';
import { AudioSystem } from './audio_system';
import { JuiceManager, ShakeType, BurstType } from './juice_effects';
import { HUDManager, GameStats } from './hud_system';
import { ParticleSystem } from './particles';

// =============================================================================
// VICTORY STATE ENUM
// =============================================================================

export enum VictoryState {
    NONE,
    APPROACHING,
    LANDING,
    CELEBRATING
}

// =============================================================================
// TYPES AND CONFIGURATION
// =============================================================================

interface FireworkParticle {
    mesh: THREE.Mesh;
    velocity: THREE.Vector3;
    life: number;
    maxLife: number;
    color: THREE.Color;
    type: 'spark' | 'heart' | 'star' | 'trail';
}

interface ConfettiPiece {
    mesh: THREE.Mesh;
    velocity: THREE.Vector3;
    rotation: THREE.Vector3;
    rotSpeed: THREE.Vector3;
    life: number;
    color: number;
}

interface StarRainParticle {
    mesh: THREE.Mesh;
    velocity: THREE.Vector3;
    life: number;
    twinklePhase: number;
}

interface FloatingText {
    element: HTMLDivElement;
    position: THREE.Vector3;
    velocity: THREE.Vector3;
    life: number;
    maxLife: number;
    scale: number;
}

interface ThankYouNote {
    group: THREE.Group;
    velocity: THREE.Vector3;
    rotSpeed: THREE.Vector3;
    life: number;
    message: string;
}

// Magical pastel colors for celebrations
const CELEBRATION_COLORS = [
    0xFFD700, // Gold
    0xFF69B4, // Hot Pink
    0x9370DB, // Medium Purple
    0x00CED1, // Dark Turquoise
    0x98FB98, // Pale Green
    0xFFB6C1, // Light Pink
    0xFFA500, // Orange
    0xFF1493, // Deep Pink
];

const CONFETTI_COLORS = [
    0xFFD700, // Gold
    0xFFB6C1, // Light Pink
    0xE6E6FA, // Lavender
    0x98FB98, // Pale Green
    0x87CEEB, // Sky Blue
    0xFFA07A, // Light Salmon
    0xDDA0DD, // Plum
    0xF0E68C, // Khaki
];

// Victory messages that float up
const VICTORY_MESSAGES = [
    "YOU DID IT!",
    "AMAZING!",
    "WOW!",
    "⭐⭐⭐",
    "SUPER STAR!",
    "MOON MISSION COMPLETE!",
    "BEST PILOT EVER!",
    "🐕🏆🌙",
];

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
        
        // Create groups for organizing celebration objects
        this.celebrationGroup = new THREE.Group();
        this.fireworksGroup = new THREE.Group();
        this.confettiGroup = new THREE.Group();
        this.starRainGroup = new THREE.Group();
        
        this.celebrationGroup.add(this.fireworksGroup);
        this.celebrationGroup.add(this.confettiGroup);
        this.celebrationGroup.add(this.starRainGroup);
        
        this.scene.add(this.celebrationGroup);
        
        // Create text container for floating messages
        this.createTextContainer();
        
        // Store original camera position
        this.originalCameraPos.copy(camera.position);
    }
    
    // =====================================================================
    // PUBLIC API
    // =====================================================================
    
    /**
     * Start the moon approach sequence
     * Call this when player gets close to the moon
     */
    startApproach(moonPosition: THREE.Vector3, moonGroup?: THREE.Group): void {
        if (this.state !== VictoryState.NONE) return;
        
        this.state = VictoryState.APPROACHING;
        this.moonPosition.copy(moonPosition);
        this.moonGroup = moonGroup;
        this.approachProgress = 0;
        this.time = 0;
        
        // Store landing zone (surface of moon)
        this.landingZone.copy(moonPosition);
        this.landingZone.y -= 8; // Adjust based on moon size
        
        // Store original camera
        this.originalCameraPos.copy(this.camera.position);
        
        // Start victory music sequence
        this.playVictoryMusic();
        
        console.log('🌙 Victory approach started!');
    }
    
    /**
     * Trigger the landing sequence
     * Call this when rocket touches moon surface
     */
    land(): void {
        if (this.state !== VictoryState.APPROACHING) return;
        
        this.state = VictoryState.LANDING;
        this.time = 0;
        
        // Create landing effects
        this.createLandingEffects();
        
        // Transition to celebration after landing animation
        setTimeout(() => {
            this.celebrate();
        }, 2000);
        
        console.log('🚀 Landed on the moon!');
    }
    
    /**
     * Start full celebration mode
     * This is the BIG celebration! 🎉
     */
    celebrate(): void {
        this.state = VictoryState.CELEBRATING;
        this.time = 0;
        this.celebrationDuration = 0;
        
        // Create celebration environment
        this.createCelebrationEnvironment();
        
        // Start all effects
        this.startFireworksDisplay();
        this.startConfettiRain();
        this.startStarRain();
        this.startRainbowBeams();
        
        // Show victory UI
        this.showVictoryUI();
        
        // Play celebration sounds
        this.playCelebrationSounds();
        
        // Show floating messages
        this.showVictoryMessages();
        
        console.log('🎉 VICTORY CELEBRATION! 🎉');
    }
    
    /**
     * Update the victory system
     * Call this every frame
     */
    update(delta: number): void {
        this.time += delta;
        
        switch (this.state) {
            case VictoryState.APPROACHING:
                this.updateApproach(delta);
                break;
            case VictoryState.LANDING:
                this.updateLanding(delta);
                break;
            case VictoryState.CELEBRATING:
                this.updateCelebration(delta);
                break;
        }
        
        // Always update effects
        this.updateFireworks(delta);
        this.updateConfetti(delta);
        this.updateStarRain(delta);
        this.updateFloatingTexts(delta);
        this.updateThankYouNotes(delta);
        this.updateRainbowBeams(delta);
    }
    
    /**
     * Reset the victory system
     * Call this when restarting the game
     */
    reset(): void {
        this.state = VictoryState.NONE;
        this.time = 0;
        this.approachProgress = 0;
        
        // Clear all effects
        this.clearAllEffects();
        
        // Remove UI
        this.removeVictoryUI();
        
        // Reset camera
        this.camera.position.copy(this.originalCameraPos);
        
        console.log('Victory system reset');
    }
    
    /**
     * Get current victory state
     */
    getState(): VictoryState {
        return this.state;
    }
    
    /**
     * Check if victory is active
     */
    isActive(): boolean {
        return this.state !== VictoryState.NONE;
    }
    
    /**
     * Set callbacks for victory events
     */
    setCallbacks(onComplete?: () => void, onReset?: () => void): void {
        this.onComplete = onComplete;
        this.onReset = onReset;
    }
    
    // =====================================================================
    // APPROACH SEQUENCE
    // =====================================================================
    
    private updateApproach(delta: number): void {
        // Gradual slow-down as approaching moon
        this.approachProgress += delta * 0.3;
        this.approachProgress = Math.min(this.approachProgress, 1);
        
        // Camera zooms in slightly as we approach
        const zoomProgress = Math.sin(this.approachProgress * Math.PI / 2);
        const targetZ = this.originalCameraPos.z - zoomProgress * 3;
        this.camera.position.z = THREE.MathUtils.lerp(this.camera.position.z, targetZ, delta * 2);
        
        // Intensify sparkle trail
        if (this.time % 0.1 < delta && this.particleSystem) {
            const sparklePos = new THREE.Vector3(
                this.moonPosition.x - 10 + Math.random() * 5,
                this.moonPosition.y + (Math.random() - 0.5) * 10,
                (Math.random() - 0.5) * 5
            );
            this.particleSystem.emit(
                sparklePos,
                CELEBRATION_COLORS[Math.floor(Math.random() * CELEBRATION_COLORS.length)],
                3,
                2 + Math.random() * 2,
                0.3 + Math.random() * 0.3,
                1.0
            );
        }
    }
    
    // =====================================================================
    // LANDING SEQUENCE
    // =====================================================================
    
    private updateLanding(delta: number): void {
        // Gentle camera movement to show landing
        const t = Math.min(this.time / 2, 1);
        const easeT = 1 - Math.pow(1 - t, 3); // Ease out cubic
        
        // Move camera to get better view of landing
        const landingCameraPos = new THREE.Vector3(
            this.landingZone.x - 15,
            this.landingZone.y + 5,
            10
        );
        
        this.camera.position.lerp(landingCameraPos, delta * 2);
        this.camera.lookAt(this.landingZone);
    }
    
    private createLandingEffects(): void {
        // Dust puff on landing
        if (this.particleSystem) {
            for (let i = 0; i < 20; i++) {
                this.particleSystem.emit(
                    this.landingZone.clone().add(new THREE.Vector3(
                        (Math.random() - 0.5) * 4,
                        Math.random() * 2,
                        (Math.random() - 0.5) * 4
                    )),
                    0xDDDDDD,
                    1,
                    1 + Math.random() * 2,
                    0.5 + Math.random() * 0.5,
                    2.0
                );
            }
        }
        
        // Screen shake for impact
        this.juice.shakeScreen(ShakeType.MEDIUM, 0.5);
        
        // Play landing sound
        this.audio.play('boing', 0.8);
        setTimeout(() => this.audio.play('magic_cast', 0.6), 200);
    }
    
    // =====================================================================
    // CELEBRATION SEQUENCE
    // =====================================================================
    
    private updateCelebration(delta: number): void {
        this.celebrationDuration += delta;
        
        // Continuous fireworks
        this.fireworkTimer -= delta;
        if (this.fireworkTimer <= 0) {
            this.launchFirework();
            this.fireworkTimer = 0.5 + Math.random() * 1.0;
        }
        
        // Continuous confetti
        this.confettiTimer -= delta;
        if (this.confettiTimer <= 0) {
            this.spawnConfettiBurst();
            this.confettiTimer = 0.3;
        }
        
        // Floating messages
        this.messageTimer -= delta;
        if (this.messageTimer <= 0) {
            this.spawnFloatingMessage();
            this.messageTimer = 1.5 + Math.random() * 1.0;
        }
        
        // Camera celebration movement
        this.updateCelebrationCamera(delta);
        
        // Spawn thank you notes occasionally
        if (Math.random() < 0.01) {
            this.spawnThankYouNote();
        }
    }
    
    private createCelebrationEnvironment(): void {
        // Change background to golden celebration colors
        const canvas = document.querySelector('#glCanvas') as HTMLCanvasElement;
        if (canvas) {
            // We'll use fog and lighting to create golden atmosphere
        }
        
        // Create celebration lighting
        const celebrationLight = new THREE.PointLight(0xFFD700, 2, 50);
        celebrationLight.position.copy(this.landingZone);
        celebrationLight.position.y += 10;
        celebrationLight.name = 'celebrationLight';
        this.scene.add(celebrationLight);
        
        // Add rim lights in pastel colors
        const colors = [0xFF69B4, 0x9370DB, 0x00CED1];
        colors.forEach((color, i) => {
            const light = new THREE.PointLight(color, 1, 30);
            const angle = (i / colors.length) * Math.PI * 2;
            light.position.set(
                this.landingZone.x + Math.cos(angle) * 15,
                this.landingZone.y + 5,
                Math.sin(angle) * 15
            );
            light.name = `celebrationRim${i}`;
            this.scene.add(light);
        });
    }
    
    private updateCelebrationCamera(delta: number): void {
        // Gentle orbiting camera
        const orbitRadius = 20;
        const orbitSpeed = 0.3;
        const orbitY = 8;
        
        const angle = this.time * orbitSpeed;
        const targetPos = new THREE.Vector3(
            this.landingZone.x + Math.cos(angle) * orbitRadius,
            this.landingZone.y + orbitY + Math.sin(this.time * 0.5) * 2,
            Math.sin(angle) * orbitRadius
        );
        
        this.camera.position.lerp(targetPos, delta * 1);
        this.camera.lookAt(this.landingZone);
    }
    
    // =====================================================================
    // FIREWORKS SYSTEM
    // =====================================================================
    
    private startFireworksDisplay(): void {
        this.fireworkTimer = 0;
        // Launch initial burst
        for (let i = 0; i < 5; i++) {
            setTimeout(() => this.launchFirework(), i * 200);
        }
    }
    
    private launchFirework(): void {
        const position = new THREE.Vector3(
            this.landingZone.x + (Math.random() - 0.5) * 30,
            this.landingZone.y + 10 + Math.random() * 15,
            (Math.random() - 0.5) * 20
        );
        
        createVictoryFireworks(position, this.scene, this.fireworksGroup);
        
        // Play firework sound
        const sounds: Array<'twinkle' | 'sparkle' | 'heart_pop'> = ['twinkle', 'sparkle', 'heart_pop'];
        this.audio.play(sounds[Math.floor(Math.random() * sounds.length)], 0.6);
    }
    
    private updateFireworks(delta: number): void {
        // Update any active fireworks in particle system
        // (handled by particle system itself)
    }
    
    // =====================================================================
    // CONFETTI SYSTEM
    // =====================================================================
    
    private startConfettiRain(): void {
        // Spawn initial burst of confetti
        for (let i = 0; i < 5; i++) {
            setTimeout(() => this.spawnConfettiBurst(), i * 100);
        }
    }
    
    private spawnConfettiBurst(): void {
        const count = 20;
        const geometry = new THREE.PlaneGeometry(0.15, 0.15);
        
        for (let i = 0; i < count; i++) {
            const color = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
            const material = new THREE.MeshBasicMaterial({
                color: color,
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 0.9
            });
            
            const mesh = new THREE.Mesh(geometry, material);
            
            // Start above the scene
            mesh.position.set(
                this.landingZone.x + (Math.random() - 0.5) * 40,
                this.landingZone.y + 20 + Math.random() * 10,
                (Math.random() - 0.5) * 20
            );
            
            mesh.rotation.set(
                Math.random() * Math.PI,
                Math.random() * Math.PI,
                Math.random() * Math.PI
            );
            
            this.confettiGroup.add(mesh);
            
            this.confetti.push({
                mesh,
                velocity: new THREE.Vector3(
                    (Math.random() - 0.5) * 2,
                    -2 - Math.random() * 3,
                    (Math.random() - 0.5) * 2
                ),
                rotation: new THREE.Vector3(mesh.rotation.x, mesh.rotation.y, mesh.rotation.z),
                rotSpeed: new THREE.Vector3(
                    (Math.random() - 0.5) * 5,
                    (Math.random() - 0.5) * 5,
                    (Math.random() - 0.5) * 5
                ),
                life: 5 + Math.random() * 3,
                color
            });
        }
    }
    
    private updateConfetti(delta: number): void {
        for (let i = this.confetti.length - 1; i >= 0; i--) {
            const piece = this.confetti[i];
            piece.life -= delta;
            
            if (piece.life <= 0) {
                this.confettiGroup.remove(piece.mesh);
                piece.mesh.geometry.dispose();
                (piece.mesh.material as THREE.Material).dispose();
                this.confetti.splice(i, 1);
                continue;
            }
            
            // Apply gravity and drift
            piece.velocity.y -= 2 * delta; // Gravity
            piece.velocity.x += Math.sin(this.time * 2 + i) * delta; // Drift
            
            // Update position
            piece.mesh.position.add(piece.velocity.clone().multiplyScalar(delta));
            
            // Update rotation
            piece.rotation.x += piece.rotSpeed.x * delta;
            piece.rotation.y += piece.rotSpeed.y * delta;
            piece.rotation.z += piece.rotSpeed.z * delta;
            piece.mesh.rotation.set(piece.rotation.x, piece.rotation.y, piece.rotation.z);
            
            // Fade out
            const fadeStart = 2;
            if (piece.life < fadeStart) {
                (piece.mesh.material as THREE.MeshBasicMaterial).opacity = piece.life / fadeStart;
            }
        }
    }
    
    // =====================================================================
    // STAR RAIN SYSTEM
    // =====================================================================
    
    private startStarRain(): void {
        createStarRain(this.scene, this.starRainGroup, this.landingZone);
    }
    
    private updateStarRain(delta: number): void {
        // Stars are managed by the createStarRain function's internal update
    }
    
    // =====================================================================
    // RAINBOW BEAMS
    // =====================================================================
    
    private startRainbowBeams(): void {
        const beamCount = 6;
        const colors = [0xFF0000, 0xFF7F00, 0xFFFF00, 0x00FF00, 0x0000FF, 0x8B00FF];
        
        for (let i = 0; i < beamCount; i++) {
            const geometry = new THREE.CylinderGeometry(0.1, 0.5, 30, 8, 1, true);
            const material = new THREE.MeshBasicMaterial({
                color: colors[i],
                transparent: true,
                opacity: 0.3,
                side: THREE.DoubleSide,
                blending: THREE.AdditiveBlending
            });
            
            const beam = new THREE.Mesh(geometry, material);
            const angle = (i / beamCount) * Math.PI * 2;
            
            beam.position.set(
                this.landingZone.x + Math.cos(angle) * 8,
                this.landingZone.y + 10,
                Math.sin(angle) * 8
            );
            
            beam.lookAt(this.landingZone);
            beam.rotateX(Math.PI / 2);
            beam.userData = { 
                baseAngle: angle, 
                phase: i * 0.5,
                speed: 0.5 + Math.random() * 0.5
            };
            
            this.celebrationGroup.add(beam);
            this.rainbowBeams.push(beam);
        }
    }
    
    private updateRainbowBeams(delta: number): void {
        this.rainbowBeams.forEach((beam, i) => {
            const data = beam.userData;
            const time = this.time * data.speed + data.phase;
            
            // Rotate around moon
            const angle = data.baseAngle + time * 0.2;
            beam.position.x = this.landingZone.x + Math.cos(angle) * 8;
            beam.position.z = this.landingZone.z + Math.sin(angle) * 8;
            beam.lookAt(this.landingZone);
            beam.rotateX(Math.PI / 2);
            
            // Pulse opacity
            const opacity = 0.2 + Math.sin(time * 2) * 0.15;
            (beam.material as THREE.MeshBasicMaterial).opacity = opacity;
        });
    }
    
    // =====================================================================
    // FLOATING TEXT SYSTEM
    // =====================================================================
    
    private showVictoryMessages(): void {
        // Show initial big message
        this.createFloatingText("YOU DID IT!", this.landingZone.clone().add(new THREE.Vector3(0, 8, 0)), 'rainbow', 64);
        
        // Queue up more messages
        VICTORY_MESSAGES.slice(1).forEach((msg, i) => {
            setTimeout(() => {
                const pos = this.landingZone.clone().add(new THREE.Vector3(
                    (Math.random() - 0.5) * 20,
                    5 + Math.random() * 10,
                    (Math.random() - 0.5) * 10
                ));
                this.createFloatingText(msg, pos, this.getRandomColor(), 36);
            }, (i + 1) * 1500);
        });
    }
    
    private spawnFloatingMessage(): void {
        const messages = ["WOW!", "AMAZING!", "⭐", "✨", "🌟", "YAY!", "HOORAY!"];
        const msg = messages[Math.floor(Math.random() * messages.length)];
        const pos = this.landingZone.clone().add(new THREE.Vector3(
            (Math.random() - 0.5) * 25,
            3 + Math.random() * 8,
            (Math.random() - 0.5) * 15
        ));
        this.createFloatingText(msg, pos, this.getRandomColor(), 28);
    }
    
    private createFloatingText(text: string, position: THREE.Vector3, color: string, size: number): void {
        if (!this.textContainer) return;
        
        const element = document.createElement('div');
        element.textContent = text;
        element.style.position = 'absolute';
        element.style.fontFamily = "'Segoe UI', 'Comic Sans MS', cursive, sans-serif";
        element.style.fontSize = `${size}px`;
        element.style.fontWeight = 'bold';
        element.style.pointerEvents = 'none';
        element.style.textShadow = '0 0 20px rgba(255,255,255,0.8), 0 0 40px rgba(255,215,0,0.5)';
        element.style.userSelect = 'none';
        element.style.zIndex = '1000';
        
        // Apply color
        if (color === 'rainbow') {
            element.style.background = 'linear-gradient(90deg, #FF69B4, #FFD700, #00CED1, #98FF98)';
            element.style.webkitBackgroundClip = 'text';
            element.style.webkitTextFillColor = 'transparent';
            element.style.backgroundClip = 'text';
        } else {
            element.style.color = color;
        }
        
        this.textContainer.appendChild(element);
        
        this.floatingTexts.push({
            element,
            position: position.clone(),
            velocity: new THREE.Vector3(0, 3 + Math.random() * 2, 0),
            life: 3,
            maxLife: 3,
            scale: 1
        });
    }
    
    private updateFloatingTexts(delta: number): void {
        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            const text = this.floatingTexts[i];
            text.life -= delta;
            
            if (text.life <= 0) {
                text.element.remove();
                this.floatingTexts.splice(i, 1);
                continue;
            }
            
            // Move up
            text.position.add(text.velocity.clone().multiplyScalar(delta));
            
            // Update screen position
            const screenPos = text.position.clone().project(this.camera);
            const x = (screenPos.x * 0.5 + 0.5) * 100;
            const y = (-screenPos.y * 0.5 + 0.5) * 100;
            
            text.element.style.left = `${x}%`;
            text.element.style.top = `${y}%`;
            text.element.style.transform = 'translate(-50%, -50%)';
            
            // Fade out
            const lifeRatio = text.life / text.maxLife;
            text.element.style.opacity = String(Math.min(1, lifeRatio * 2));
        }
    }
    
    // =====================================================================
    // THANK YOU NOTES
    // =====================================================================
    
    private spawnThankYouNote(): void {
        const messages = [
            "Thank you!",
            "You're the best!",
            "Amazing flight!",
            "Moon pals forever!",
            "So brave!",
            "⭐ Star pilot! ⭐"
        ];
        const message = messages[Math.floor(Math.random() * messages.length)];
        
        const note = createThankYouNote(
            this.landingZone.clone().add(new THREE.Vector3(
                (Math.random() - 0.5) * 30,
                15 + Math.random() * 10,
                (Math.random() - 0.5) * 20
            )),
            message
        );
        
        this.scene.add(note);
        
        this.thankYouNotes.push({
            group: note,
            velocity: new THREE.Vector3(
                (Math.random() - 0.5) * 2,
                -0.5 - Math.random(),
                (Math.random() - 0.5) * 2
            ),
            rotSpeed: new THREE.Vector3(
                (Math.random() - 0.5) * 1,
                (Math.random() - 0.5) * 1,
                (Math.random() - 0.5) * 1
            ),
            life: 10,
            message
        });
    }
    
    private updateThankYouNotes(delta: number): void {
        for (let i = this.thankYouNotes.length - 1; i >= 0; i--) {
            const note = this.thankYouNotes[i];
            note.life -= delta;
            
            if (note.life <= 0) {
                this.scene.remove(note.group);
                this.thankYouNotes.splice(i, 1);
                continue;
            }
            
            // Float down gently
            note.group.position.add(note.velocity.clone().multiplyScalar(delta));
            note.group.rotation.x += note.rotSpeed.x * delta;
            note.group.rotation.y += note.rotSpeed.y * delta;
            note.group.rotation.z += note.rotSpeed.z * delta;
            
            // Fade out
            const fadeStart = 3;
            if (note.life < fadeStart) {
                note.group.traverse((child) => {
                    if (child instanceof THREE.Mesh && child.material) {
                        const mat = child.material as THREE.Material;
                        if ('opacity' in mat) {
                            (mat as any).opacity = note.life / fadeStart;
                        }
                    }
                });
            }
        }
    }
    
    // =====================================================================
    // VICTORY UI
    // =====================================================================
    
    private showVictoryUI(): void {
        // Create victory overlay
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
        
        // Button container
        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = `
            display: flex;
            gap: 20px;
            pointer-events: auto;
        `;
        
        // Play Again button
        const playAgainBtn = this.createVictoryButton('🎮 Play Again', '#4CAF50');
        playAgainBtn.onclick = () => {
            this.audio.play('ui_click');
            if (this.onReset) {
                this.onReset();
            } else {
                location.reload();
            }
        };
        
        // Back to Menu button
        const menuBtn = this.createVictoryButton('🏠 Back to Menu', '#2196F3');
        menuBtn.onclick = () => {
            this.audio.play('ui_click');
            // Navigate to menu (or reload for now)
            location.reload();
        };
        
        buttonContainer.appendChild(playAgainBtn);
        buttonContainer.appendChild(menuBtn);
        this.victoryOverlay.appendChild(buttonContainer);
        
        document.body.appendChild(this.victoryOverlay);
        
        // Trigger HUD victory screen
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
        
        // Remove all floating texts
        this.floatingTexts.forEach(text => text.element.remove());
        this.floatingTexts = [];
    }
    
    // =====================================================================
    // AUDIO
    // =====================================================================
    
    private playVictoryMusic(): void {
        // Play magical sequence
        this.audio.playMagicSequence('spell_complete');
        
        // Continue with happy sounds
        setTimeout(() => {
            this.audio.playMagicSound('happy');
        }, 800);
        
        setTimeout(() => {
            this.audio.play('magic_cast', 0.7);
        }, 1500);
    }
    
    private playCelebrationSounds(): void {
        // Continuous magical sounds
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
        // Remove fireworks
        this.fireworks = [];
        
        // Remove confetti
        this.confetti.forEach(piece => {
            this.confettiGroup.remove(piece.mesh);
            piece.mesh.geometry.dispose();
            (piece.mesh.material as THREE.Material).dispose();
        });
        this.confetti = [];
        
        // Remove star rain
        this.starRain = [];
        
        // Remove thank you notes
        this.thankYouNotes.forEach(note => {
            this.scene.remove(note.group);
        });
        this.thankYouNotes = [];
        
        // Remove rainbow beams
        this.rainbowBeams.forEach(beam => {
            this.celebrationGroup.remove(beam);
            beam.geometry.dispose();
            (beam.material as THREE.Material).dispose();
        });
        this.rainbowBeams = [];
        
        // Remove celebration lights
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
        
        // Clear groups
        while(this.fireworksGroup.children.length > 0) {
            this.fireworksGroup.remove(this.fireworksGroup.children[0]);
        }
        while(this.confettiGroup.children.length > 0) {
            this.confettiGroup.remove(this.confettiGroup.children[0]);
        }
        while(this.starRainGroup.children.length > 0) {
            this.starRainGroup.remove(this.starRainGroup.children[0]);
        }
        
        // Remove text container
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
    
    // =====================================================================
    // CLEANUP
    // =====================================================================
    
    dispose(): void {
        this.reset();
        this.scene.remove(this.celebrationGroup);
    }
}

// =============================================================================
// STANDALONE FUNCTIONS
// =============================================================================

/**
 * Create spectacular victory fireworks at a position
 */
export function createVictoryFireworks(position: THREE.Vector3, scene: THREE.Scene, parent?: THREE.Group): void {
    const colors = [0xFFD700, 0xFF69B4, 0x9370DB, 0x00CED1, 0x98FB98];
    const color = colors[Math.floor(Math.random() * colors.length)];
    
    // Create explosion burst
    const particleCount = 30;
    const geometries = [
        new THREE.SphereGeometry(0.1, 4, 4),
        new THREE.ConeGeometry(0.1, 0.3, 4),
        new THREE.TetrahedronGeometry(0.15)
    ];
    
    const container = parent || scene;
    
    // Create heart shape particles
    for (let i = 0; i < particleCount; i++) {
        const geometry = geometries[Math.floor(Math.random() * geometries.length)];
        const material = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.9
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(position);
        
        // Explosive velocity in sphere pattern
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const speed = 5 + Math.random() * 10;
        
        const velocity = new THREE.Vector3(
            speed * Math.sin(phi) * Math.cos(theta),
            speed * Math.sin(phi) * Math.sin(theta),
            speed * Math.cos(phi)
        );
        
        container.add(mesh);
        
        // Animate and remove
        const life = 1 + Math.random() * 0.5;
        let elapsed = 0;
        
        const animate = () => {
            elapsed += 0.016;
            if (elapsed >= life) {
                container.remove(mesh);
                geometry.dispose();
                material.dispose();
                return;
            }
            
            // Move
            velocity.y -= 9.8 * 0.016; // Gravity
            mesh.position.add(velocity.clone().multiplyScalar(0.016));
            mesh.rotation.x += 0.1;
            mesh.rotation.y += 0.1;
            
            // Fade
            material.opacity = 0.9 * (1 - elapsed / life);
            
            requestAnimationFrame(animate);
        };
        
        animate();
    }
    
    // Add sparkle rings
    for (let ring = 0; ring < 3; ring++) {
        setTimeout(() => {
            const ringGeometry = new THREE.RingGeometry(0.5 + ring * 0.5, 0.7 + ring * 0.5, 16);
            const ringMaterial = new THREE.MeshBasicMaterial({
                color: colors[(colors.indexOf(color) + ring) % colors.length],
                transparent: true,
                opacity: 0.6,
                side: THREE.DoubleSide
            });
            
            const ringMesh = new THREE.Mesh(ringGeometry, ringMaterial);
            ringMesh.position.copy(position);
            ringMesh.lookAt(position.clone().add(new THREE.Vector3(0, 1, 0)));
            container.add(ringMesh);
            
            // Expand and fade
            let ringElapsed = 0;
            const ringLife = 1;
            
            const animateRing = () => {
                ringElapsed += 0.016;
                if (ringElapsed >= ringLife) {
                    container.remove(ringMesh);
                    ringGeometry.dispose();
                    ringMaterial.dispose();
                    return;
                }
                
                const scale = 1 + ringElapsed * 5;
                ringMesh.scale.setScalar(scale);
                ringMaterial.opacity = 0.6 * (1 - ringElapsed / ringLife);
                
                requestAnimationFrame(animateRing);
            };
            
            animateRing();
        }, ring * 100);
    }
}

/**
 * Create magical star rain effect
 */
export function createStarRain(scene: THREE.Scene, parent?: THREE.Group, center?: THREE.Vector3): void {
    const container = parent || scene;
    const centerPos = center || new THREE.Vector3();
    
    const starGeometry = new THREE.OctahedronGeometry(0.2, 0);
    const starCount = 50;
    
    for (let i = 0; i < starCount; i++) {
        const hue = Math.random();
        const color = new THREE.Color().setHSL(hue, 1, 0.7);
        
        const material = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.9
        });
        
        const star = new THREE.Mesh(starGeometry, material);
        
        // Start high up
        star.position.set(
            centerPos.x + (Math.random() - 0.5) * 40,
            centerPos.y + 30 + Math.random() * 20,
            centerPos.z + (Math.random() - 0.5) * 20
        );
        
        star.rotation.set(
            Math.random() * Math.PI,
            Math.random() * Math.PI,
            Math.random() * Math.PI
        );
        
        container.add(star);
        
        // Animate falling
        const velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 2,
            -5 - Math.random() * 5,
            (Math.random() - 0.5) * 2
        );
        
        const rotSpeed = new THREE.Vector3(
            (Math.random() - 0.5) * 5,
            (Math.random() - 0.5) * 5,
            (Math.random() - 0.5) * 5
        );
        
        let life = 5 + Math.random() * 5;
        const twinklePhase = Math.random() * Math.PI * 2;
        
        const animate = () => {
            life -= 0.016;
            if (life <= 0 || star.position.y < centerPos.y - 10) {
                container.remove(star);
                return;
            }
            
            // Move
            star.position.add(velocity.clone().multiplyScalar(0.016));
            
            // Rotate
            star.rotation.x += rotSpeed.x * 0.016;
            star.rotation.y += rotSpeed.y * 0.016;
            star.rotation.z += rotSpeed.z * 0.016;
            
            // Twinkle
            const twinkle = 0.5 + Math.sin(Date.now() * 0.005 + twinklePhase) * 0.5;
            material.opacity = 0.5 + twinkle * 0.5;
            
            requestAnimationFrame(animate);
        };
        
        // Stagger start
        setTimeout(() => animate(), Math.random() * 3000);
    }
    
    // Continuously spawn new stars
    const spawnInterval = setInterval(() => {
        if (!container.parent && container !== scene) {
            clearInterval(spawnInterval);
            return;
        }
        
        const hue = Math.random();
        const color = new THREE.Color().setHSL(hue, 1, 0.7);
        
        const material = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.9
        });
        
        const star = new THREE.Mesh(starGeometry, material);
        star.position.set(
            centerPos.x + (Math.random() - 0.5) * 40,
            centerPos.y + 30 + Math.random() * 10,
            centerPos.z + (Math.random() - 0.5) * 20
        );
        
        container.add(star);
        
        const velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 2,
            -5 - Math.random() * 5,
            (Math.random() - 0.5) * 2
        );
        
        let life = 5 + Math.random() * 5;
        
        const animate = () => {
            life -= 0.016;
            if (life <= 0 || star.position.y < centerPos.y - 10) {
                container.remove(star);
                return;
            }
            
            star.position.add(velocity.clone().multiplyScalar(0.016));
            star.rotation.x += 0.05;
            star.rotation.y += 0.05;
            
            requestAnimationFrame(animate);
        };
        
        animate();
    }, 200);
}

/**
 * Create a floating thank-you note from the moon palace
 */
export function createThankYouNote(position: THREE.Vector3, message: string): THREE.Group {
    const group = new THREE.Group();
    group.position.copy(position);
    
    // Paper background
    const paperGeometry = new THREE.PlaneGeometry(2, 1.2);
    const paperMaterial = new THREE.MeshBasicMaterial({
        color: 0xFFFACD,
        transparent: true,
        opacity: 0.95,
        side: THREE.DoubleSide
    });
    const paper = new THREE.Mesh(paperGeometry, paperMaterial);
    group.add(paper);
    
    // Decorative border
    const borderGeometry = new THREE.RingGeometry(0.9, 1.0, 32);
    const borderMaterial = new THREE.MeshBasicMaterial({
        color: 0xFFD700,
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide
    });
    const border = new THREE.Mesh(borderGeometry, borderMaterial);
    border.scale.set(2.2, 1.3, 1);
    group.add(border);
    
    // Sparkle decorations
    for (let i = 0; i < 4; i++) {
        const sparkleGeometry = new THREE.OctahedronGeometry(0.1, 0);
        const sparkleMaterial = new THREE.MeshBasicMaterial({
            color: 0xFFD700,
            transparent: true,
            opacity: 0.8
        });
        const sparkle = new THREE.Mesh(sparkleGeometry, sparkleMaterial);
        sparkle.position.set(
            (i % 2 === 0 ? 1 : -1) * 0.9,
            (i < 2 ? 0.5 : -0.5),
            0.05
        );
        group.add(sparkle);
    }
    
    // Create text texture using canvas
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    
    // Background
    ctx.fillStyle = '#FFFACD';
    ctx.fillRect(0, 0, 256, 128);
    
    // Text
    ctx.fillStyle = '#8B4513';
    ctx.font = 'bold 24px "Comic Sans MS", cursive, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Word wrap
    const words = message.split(' ');
    const lines: string[] = [];
    let currentLine = '';
    
    for (const word of words) {
        const testLine = currentLine + (currentLine ? ' ' : '') + word;
        const metrics = ctx.measureText(testLine);
        if (metrics.width > 220 && currentLine) {
            lines.push(currentLine);
            currentLine = word;
        } else {
            currentLine = testLine;
        }
    }
    lines.push(currentLine);
    
    const lineHeight = 28;
    const startY = 64 - ((lines.length - 1) * lineHeight) / 2;
    
    lines.forEach((line, i) => {
        ctx.fillText(line, 128, startY + i * lineHeight);
    });
    
    // Create texture
    const texture = new THREE.CanvasTexture(canvas);
    const textMaterial = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: 0.9
    });
    const textPlane = new THREE.Mesh(paperGeometry, textMaterial);
    textPlane.position.z = 0.01;
    group.add(textPlane);
    
    return group;
}

// Add CSS animation for buttons
const style = document.createElement('style');
style.textContent = `
    @keyframes victory-button-bounce {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-5px); }
    }
`;
document.head.appendChild(style);
