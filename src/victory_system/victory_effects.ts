import * as THREE from 'three';
import { AudioSystem } from '../audio_system';
import {
    ConfettiPiece,
    FloatingText,
    ThankYouNote,
    CONFETTI_COLORS,
    VICTORY_MESSAGES,
} from './types';
import { createVictoryFireworks, createStarRain, createThankYouNote } from './helpers';

export interface VictoryEffectsContext {
    scene: THREE.Scene;
    camera: THREE.Camera;
    audio: AudioSystem;
    time: number;
    landingZone: THREE.Vector3;
    celebrationGroup: THREE.Group;
    fireworksGroup: THREE.Group;
    confettiGroup: THREE.Group;
    starRainGroup: THREE.Group;
    confetti: ConfettiPiece[];
    rainbowBeams: THREE.Mesh[];
    floatingTexts: FloatingText[];
    thankYouNotes: ThankYouNote[];
    textContainer?: HTMLDivElement;
}

export function startFireworksDisplay(ctx: VictoryEffectsContext): void {
    for (let i = 0; i < 5; i++) {
        setTimeout(() => launchFirework(ctx), i * 200);
    }
}

export function launchFirework(ctx: VictoryEffectsContext): void {
    const position = new THREE.Vector3(
        ctx.landingZone.x + (Math.random() - 0.5) * 30,
        ctx.landingZone.y + 10 + Math.random() * 15,
        (Math.random() - 0.5) * 20
    );

    createVictoryFireworks(position, ctx.scene, ctx.fireworksGroup);

    const sounds: Array<'twinkle' | 'sparkle' | 'heart_pop'> = ['twinkle', 'sparkle', 'heart_pop'];
    ctx.audio.play(sounds[Math.floor(Math.random() * sounds.length)], 0.6);
}

export function updateFireworks(_ctx: VictoryEffectsContext, _delta: number): void {
    // Handled by particle system
}

export function startConfettiRain(ctx: VictoryEffectsContext): void {
    for (let i = 0; i < 5; i++) {
        setTimeout(() => spawnConfettiBurst(ctx), i * 100);
    }
}

export function spawnConfettiBurst(ctx: VictoryEffectsContext): void {
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

        mesh.position.set(
            ctx.landingZone.x + (Math.random() - 0.5) * 40,
            ctx.landingZone.y + 20 + Math.random() * 10,
            (Math.random() - 0.5) * 20
        );

        mesh.rotation.set(
            Math.random() * Math.PI,
            Math.random() * Math.PI,
            Math.random() * Math.PI
        );

        ctx.confettiGroup.add(mesh);

        ctx.confetti.push({
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

export function updateConfetti(ctx: VictoryEffectsContext, delta: number): void {
    for (let i = ctx.confetti.length - 1; i >= 0; i--) {
        const piece = ctx.confetti[i];
        piece.life -= delta;

        if (piece.life <= 0) {
            ctx.confettiGroup.remove(piece.mesh);
            piece.mesh.geometry.dispose();
            (piece.mesh.material as THREE.Material).dispose();
            ctx.confetti.splice(i, 1);
            continue;
        }

        piece.velocity.y -= 2 * delta;
        piece.velocity.x += Math.sin(ctx.time * 2 + i) * delta;

        piece.mesh.position.add(piece.velocity.clone().multiplyScalar(delta));

        piece.rotation.x += piece.rotSpeed.x * delta;
        piece.rotation.y += piece.rotSpeed.y * delta;
        piece.rotation.z += piece.rotSpeed.z * delta;
        piece.mesh.rotation.set(piece.rotation.x, piece.rotation.y, piece.rotation.z);

        const fadeStart = 2;
        if (piece.life < fadeStart) {
            (piece.mesh.material as THREE.MeshBasicMaterial).opacity = piece.life / fadeStart;
        }
    }
}

export function startStarRain(ctx: VictoryEffectsContext): void {
    createStarRain(ctx.scene, ctx.starRainGroup, ctx.landingZone);
}

export function updateStarRain(_ctx: VictoryEffectsContext, _delta: number): void {
    // Stars are managed by createStarRain's internal update
}

export function startRainbowBeams(ctx: VictoryEffectsContext): void {
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
            ctx.landingZone.x + Math.cos(angle) * 8,
            ctx.landingZone.y + 10,
            Math.sin(angle) * 8
        );

        beam.lookAt(ctx.landingZone);
        beam.rotateX(Math.PI / 2);
        beam.userData = {
            baseAngle: angle,
            phase: i * 0.5,
            speed: 0.5 + Math.random() * 0.5
        };

        ctx.celebrationGroup.add(beam);
        ctx.rainbowBeams.push(beam);
    }
}

export function updateRainbowBeams(ctx: VictoryEffectsContext, _delta: number): void {
    ctx.rainbowBeams.forEach((beam) => {
        const data = beam.userData;
        const time = ctx.time * data.speed + data.phase;

        const angle = data.baseAngle + time * 0.2;
        beam.position.x = ctx.landingZone.x + Math.cos(angle) * 8;
        beam.position.z = ctx.landingZone.z + Math.sin(angle) * 8;
        beam.lookAt(ctx.landingZone);
        beam.rotateX(Math.PI / 2);

        const opacity = 0.2 + Math.sin(time * 2) * 0.15;
        (beam.material as THREE.MeshBasicMaterial).opacity = opacity;
    });
}

export function showVictoryMessages(ctx: VictoryEffectsContext, getRandomColor: () => string): void {
    createFloatingText(ctx, "YOU DID IT!", ctx.landingZone.clone().add(new THREE.Vector3(0, 8, 0)), 'rainbow', 64);

    VICTORY_MESSAGES.slice(1).forEach((msg, i) => {
        setTimeout(() => {
            const pos = ctx.landingZone.clone().add(new THREE.Vector3(
                (Math.random() - 0.5) * 20,
                5 + Math.random() * 10,
                (Math.random() - 0.5) * 10
            ));
            createFloatingText(ctx, msg, pos, getRandomColor(), 36);
        }, (i + 1) * 1500);
    });
}

export function spawnFloatingMessage(ctx: VictoryEffectsContext, getRandomColor: () => string): void {
    const messages = ["WOW!", "AMAZING!", "⭐", "✨", "🌟", "YAY!", "HOORAY!"];
    const msg = messages[Math.floor(Math.random() * messages.length)];
    const pos = ctx.landingZone.clone().add(new THREE.Vector3(
        (Math.random() - 0.5) * 25,
        3 + Math.random() * 8,
        (Math.random() - 0.5) * 15
    ));
    createFloatingText(ctx, msg, pos, getRandomColor(), 28);
}

export function createFloatingText(
    ctx: VictoryEffectsContext,
    text: string,
    position: THREE.Vector3,
    color: string,
    size: number
): void {
    if (!ctx.textContainer) return;

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

    if (color === 'rainbow') {
        element.style.background = 'linear-gradient(90deg, #FF69B4, #FFD700, #00CED1, #98FF98)';
        element.style.webkitBackgroundClip = 'text';
        element.style.webkitTextFillColor = 'transparent';
        element.style.backgroundClip = 'text';
    } else {
        element.style.color = color;
    }

    ctx.textContainer.appendChild(element);

    ctx.floatingTexts.push({
        element,
        position: position.clone(),
        velocity: new THREE.Vector3(0, 3 + Math.random() * 2, 0),
        life: 3,
        maxLife: 3,
        scale: 1
    });
}

export function updateFloatingTexts(ctx: VictoryEffectsContext, delta: number): void {
    for (let i = ctx.floatingTexts.length - 1; i >= 0; i--) {
        const text = ctx.floatingTexts[i];
        text.life -= delta;

        if (text.life <= 0) {
            text.element.remove();
            ctx.floatingTexts.splice(i, 1);
            continue;
        }

        text.position.add(text.velocity.clone().multiplyScalar(delta));

        const screenPos = text.position.clone().project(ctx.camera);
        const x = (screenPos.x * 0.5 + 0.5) * 100;
        const y = (-screenPos.y * 0.5 + 0.5) * 100;

        text.element.style.left = `${x}%`;
        text.element.style.top = `${y}%`;
        text.element.style.transform = 'translate(-50%, -50%)';

        const lifeRatio = text.life / text.maxLife;
        text.element.style.opacity = String(Math.min(1, lifeRatio * 2));
    }
}

export function spawnThankYouNote(ctx: VictoryEffectsContext): void {
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
        ctx.landingZone.clone().add(new THREE.Vector3(
            (Math.random() - 0.5) * 30,
            15 + Math.random() * 10,
            (Math.random() - 0.5) * 20
        )),
        message
    );

    ctx.scene.add(note);

    ctx.thankYouNotes.push({
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

export function updateThankYouNotes(ctx: VictoryEffectsContext, delta: number): void {
    for (let i = ctx.thankYouNotes.length - 1; i >= 0; i--) {
        const note = ctx.thankYouNotes[i];
        note.life -= delta;

        if (note.life <= 0) {
            ctx.scene.remove(note.group);
            ctx.thankYouNotes.splice(i, 1);
            continue;
        }

        note.group.position.add(note.velocity.clone().multiplyScalar(delta));
        note.group.rotation.x += note.rotSpeed.x * delta;
        note.group.rotation.y += note.rotSpeed.y * delta;
        note.group.rotation.z += note.rotSpeed.z * delta;

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

export function clearVictoryEffects(ctx: VictoryEffectsContext): void {
    ctx.confetti.forEach(piece => {
        ctx.confettiGroup.remove(piece.mesh);
        piece.mesh.geometry.dispose();
        (piece.mesh.material as THREE.Material).dispose();
    });
    ctx.confetti = [];

    ctx.thankYouNotes.forEach(note => {
        ctx.scene.remove(note.group);
    });
    ctx.thankYouNotes = [];

    ctx.rainbowBeams.forEach(beam => {
        ctx.celebrationGroup.remove(beam);
        beam.geometry.dispose();
        (beam.material as THREE.Material).dispose();
    });
    ctx.rainbowBeams = [];

    while (ctx.fireworksGroup.children.length > 0) {
        ctx.fireworksGroup.remove(ctx.fireworksGroup.children[0]);
    }
    while (ctx.confettiGroup.children.length > 0) {
        ctx.confettiGroup.remove(ctx.confettiGroup.children[0]);
    }
    while (ctx.starRainGroup.children.length > 0) {
        ctx.starRainGroup.remove(ctx.starRainGroup.children[0]);
    }

    ctx.floatingTexts.forEach(text => text.element.remove());
    ctx.floatingTexts = [];
}
