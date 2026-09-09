import * as THREE from 'three';
import type { AudioPort } from '../ports';
import type { ParticleSystem } from '../particles';
import type { InteractionResult, TrappedFriendKind } from './types';
import { SpaceKitty } from './SpaceKitty';
import { SpaceBunny } from './SpaceBunny';
import { WishLantern } from './WishLantern';
import { FlotillaMember } from './FlotillaMember';

export interface FriendInteractionHost {
    scene: THREE.Scene;
    audio: AudioPort;
    particles: ParticleSystem;
    kitties: SpaceKitty[];
    bunnies: SpaceBunny[];
    lanterns: WishLantern[];
    flotilla: FlotillaMember[];
    lastKittySound: number;
    lastBunnySound: number;
    lastLanternSound: number;
    lastTarsierSound: number;
    lastOtterSound: number;
    lastPenguinSound: number;
    lastSealSound: number;
    lastAstroBunnySound: number;
    lastLemurSound: number;
    onOtterGift?: (position: THREE.Vector3, cores: number) => void;
    onPenguinSlide?: (position: THREE.Vector3, cores: number, slideAssistDuration: number) => void;
    onSealClap?: (position: THREE.Vector3, healthRestore?: number) => void;
    onAstroBunnyLucky?: (position: THREE.Vector3, bonus: number) => void;
    onLemurHeartGift?: (position: THREE.Vector3) => void;
}

export function isFriendDisturbed(
    friendPos: THREE.Vector3,
    projectiles: { active: boolean; mesh: THREE.Mesh }[],
    radius: number = 14
): boolean {
    for (const proj of projectiles) {
        if (!proj.active) continue;
        if (proj.mesh.position.distanceTo(friendPos) < radius) {
            return true;
        }
    }
    return false;
}

export function handleInteraction(
    host: FriendInteractionHost,
    result: InteractionResult,
    now: number
): void {
    switch (result.type) {
        case 'kitty_wave':
            if (now - host.lastKittySound > 2000) {
                host.audio.play('twinkle', 0.6);
                host.lastKittySound = now;
            }
            host.particles.emit(result.position, 0xffd700, 8, 3.0, 0.5, 1.0);
            break;

        case 'bunny_heal':
            if (now - host.lastBunnySound > 3000) {
                host.audio.play('heart_pop', 0.7);
                host.lastBunnySound = now;
            }
            host.particles.emit(result.position, 0xff69b4, 12, 4.0, 0.6, 1.5);
            break;

        case 'lantern_pop':
            break;

        case 'tarsier_cheer':
            if (now - host.lastTarsierSound > 1500) {
                host.audio.play('twinkle', 0.5);
                host.lastTarsierSound = now;
            }
            host.particles.emit(result.position, 0xffd966, 10, 3.5, 0.5, 1.2);
            break;

        case 'tarsier_panic':
            if (now - host.lastTarsierSound > 1000) {
                host.audio.play('sparkle', 0.35);
                host.lastTarsierSound = now;
            }
            host.particles.emit(result.position, 0xaaddcc, 6, 2.0, 0.3, 0.8);
            break;

        case 'otter_gift':
            if (now - host.lastOtterSound > 2500) {
                if (typeof host.audio.playSequence === 'function') {
                    host.audio.playSequence([
                        { sound: 'twinkle', delay: 0, volume: 0.75 },
                        { sound: 'sparkle', delay: 0.08, volume: 0.55 }
                    ]);
                } else {
                    host.audio.play('twinkle', 0.75);
                }
                host.lastOtterSound = now;
            }
            host.particles.emit(result.position, 0xffdd44, 14, 4.5, 0.6, 1.4);
            host.particles.emit(result.position, 0x44ccff, 10, 3.0, 0.5, 1.0);
            host.onOtterGift?.(result.position, result.bonus ?? 1);
            break;

        case 'otter_sploosh':
            host.particles.emit(result.position, 0x44ccff, 5, 2.2, 0.35, 0.7);
            break;

        case 'penguin_slide':
            if (now - host.lastPenguinSound > 2800) {
                if (typeof host.audio.playSequence === 'function') {
                    host.audio.playSequence([
                        { sound: 'heart_pop', delay: 0, volume: 0.65 },
                        { sound: 'sparkle', delay: 0.12, volume: 0.5 }
                    ]);
                } else {
                    host.audio.play('heart_pop', 0.65);
                }
                host.lastPenguinSound = now;
            }
            host.particles.emit(result.position, 0xffffff, 12, 4.0, 0.5, 1.2);
            host.particles.emit(result.position, 0x88ccff, 10, 3.5, 0.4, 1.0);
            host.onPenguinSlide?.(
                result.position,
                result.bonus ?? 1,
                result.slideAssistDuration ?? 3
            );
            break;

        case 'penguin_ice_trail':
            host.particles.emit(result.position, 0xddeeff, 4, 1.8, 0.25, 0.5);
            host.particles.emit(result.position, 0xaaddff, 3, 1.2, 0.2, 0.4);
            break;

        case 'seal_clap':
            if (now - host.lastSealSound > 2200) {
                if (typeof host.audio.playSealClap === 'function') {
                    host.audio.playSealClap();
                } else {
                    host.audio.play('twinkle', 0.7);
                }
                host.lastSealSound = now;
            }
            host.particles.emit(result.position, 0xffffff, 5, 1.5, 0.2, 0.5);
            host.particles.emit(result.position, 0xaaddff, 4, 1.2, 0.15, 0.4);
            host.onSealClap?.(result.position, result.healthRestore);
            break;

        case 'seal_bubble_puff':
            host.particles.emit(result.position, 0xffffff, 4, 1.0, 0.12, 0.35);
            host.particles.emit(result.position, 0xcceeff, 3, 0.8, 0.1, 0.3);
            break;

        case 'astro_bunny_lucky':
            if (now - host.lastAstroBunnySound > 2800) {
                if (typeof host.audio.playSequence === 'function') {
                    host.audio.playSequence([
                        { sound: 'boing', delay: 0, volume: 0.7 },
                        { sound: 'twinkle', delay: 0.1, volume: 0.65 },
                        { sound: 'sparkle', delay: 0.2, volume: 0.5 }
                    ]);
                } else {
                    host.audio.play('boing', 0.7);
                }
                host.lastAstroBunnySound = now;
            }
            host.particles.emit(result.position, 0xffd700, 12, 4.0, 0.45, 1.1);
            host.particles.emit(result.position, 0xfff0f5, 8, 3.0, 0.35, 0.9);
            host.onAstroBunnyLucky?.(result.position, result.bonus ?? 8);
            break;

        case 'astro_bunny_sparkle':
            host.particles.emit(result.position, 0xffeedd, 5, 2.0, 0.2, 0.5);
            host.particles.emit(result.position, 0xffffff, 4, 1.5, 0.12, 0.4);
            break;

        case 'lemur_heart_gift':
            if (now - host.lastLemurSound > 3200) {
                if (typeof host.audio.playSequence === 'function') {
                    host.audio.playSequence([
                        { sound: 'heart_pop', delay: 0, volume: 0.7 },
                        { sound: 'twinkle', delay: 0.12, volume: 0.55 }
                    ]);
                } else {
                    host.audio.play('heart_pop', 0.7);
                }
                host.lastLemurSound = now;
            }
            host.particles.emit(result.position, 0xff69b4, 10, 3.5, 0.45, 1.0);
            host.onLemurHeartGift?.(result.position);
            break;

        case 'lemur_panic':
            if (now - host.lastLemurSound > 1200) {
                host.audio.play('sparkle', 0.3);
                host.lastLemurSound = now;
            }
            host.particles.emit(result.position, 0xccb8dd, 5, 2.2, 0.3, 0.7);
            break;
    }
}

export function checkInteractions(
    host: FriendInteractionHost,
    playerPos: THREE.Vector3
): InteractionResult[] {
    const results: InteractionResult[] = [];

    for (const kitty of host.kitties) {
        const result = kitty.update(0, playerPos);
        if (result) results.push(result);
    }

    for (const bunny of host.bunnies) {
        const result = bunny.update(0, playerPos);
        if (result) results.push(result);
    }

    for (const lantern of host.lanterns) {
        const result = lantern.update(0, playerPos);
        if (result) results.push(result);
    }

    return results;
}

export function popLantern(
    host: FriendInteractionHost,
    lantern: WishLantern
): boolean {
    const now = Date.now();

    if (now - host.lastLanternSound > 1000) {
        if (typeof host.audio.playSequence === 'function') {
            host.audio.playSequence([
                { sound: 'twinkle', delay: 0, volume: 0.8 },
                { sound: 'sparkle', delay: 0.1, volume: 0.6 },
                { sound: 'giggle', delay: 0.2, volume: 0.5 }
            ]);
        } else {
            host.audio.play('twinkle', 0.8);
        }
        host.lastLanternSound = now;
    }

    return lantern.pop(host.scene, host.particles);
}

export function cheerFlotilla(
    host: FriendInteractionHost,
    position: THREE.Vector3
): void {
    if (host.flotilla.length === 0) return;
    for (const member of host.flotilla) {
        member.cheer();
    }
    host.particles.emit(position, 0xff69b4, 6 + host.flotilla.length * 2, 3.0, 0.5, 1.0);
}
