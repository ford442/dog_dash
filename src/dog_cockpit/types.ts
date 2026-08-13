/**
 * Dog Cockpit Animation System 🐕🚀
 * Adorable dog astronaut animations for Dog Dash
 * A magical space game for a 7-year-old girl
 */

import * as THREE from 'three';
import type { HappyParticle } from './happy_particle';

/** Animation states for the dog astronaut */
export enum DogAnimationState {
    IDLE = 'idle',
    THRUST = 'thrust',
    COLLECT = 'collect',
    POWER_UP = 'power_up',
    HIT = 'hit',
    VICTORY = 'victory',
    CURIOUS = 'curious',
    DELIGHTED = 'delighted',
    BARK = 'bark'
}

/** Accessory types that can be unlocked and equipped */
export enum DogAccessory {
    TUTU = 'tutu',
    CAPE = 'cape',
    BOW = 'bow',
    GLASSES = 'glasses',
    CROWN = 'crown'
}

/** Configuration for accessory unlocks */
export interface AccessoryUnlock {
    type: DogAccessory;
    name: string;
    description: string;
    cost: number;
    requirement?: () => boolean;
}

/** Interface for bone references */
export interface DogBones {
    root?: THREE.Bone;
    body?: THREE.Bone;
    head?: THREE.Bone;
    neck?: THREE.Bone;
    tail?: THREE.Bone;
    tailTip?: THREE.Bone;
    leftEar?: THREE.Bone;
    rightEar?: THREE.Bone;
    leftFrontPaw?: THREE.Bone;
    rightFrontPaw?: THREE.Bone;
    leftBackPaw?: THREE.Bone;
    rightBackPaw?: THREE.Bone;
    nose?: THREE.Bone;
    // Alternative naming conventions
    earLeft?: THREE.Bone;
    earRight?: THREE.Bone;
    pilotHead?: THREE.Object3D;
    pilotGroup?: THREE.Object3D;
}

/** Animation data for each bone */
export interface BoneAnimationData {
    basePosition: THREE.Vector3;
    baseRotation: THREE.Euler;
    baseScale: THREE.Vector3;
    animationOffset: number;
}

/** Shared animation host surface for extracted dog cockpit helpers */
export interface DogAnimationHost {
    bones: DogBones;
    boneData: Map<string, BoneAnimationData>;
    time: number;
    happiness: number;
    excitement: number;
    worry: number;
    tailWagSpeed: number;
    tailWagIntensity: number;
    earPerkAmount: number;
    headTiltAngle: number;
    bounceAmount: number;
    happyParticles: HappyParticle[];
    scene?: THREE.Scene;
    accessoryGroup?: THREE.Group;
    wagTail(speed: number, intensity: number): void;
    perkEars(amount: number): void;
    tiltHead(angle: number): void;
    twitchEars(deltaTime: number): void;
    spawnHappyParticles(): void;
    raisePaws(raise: boolean): void;
    boopNose(): void;
}
