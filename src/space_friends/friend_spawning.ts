import * as THREE from 'three';
import { SpaceKitty } from './SpaceKitty';
import { SpaceBunny } from './SpaceBunny';
import { WishLantern } from './WishLantern';
import { AstroTarsier } from './AstroTarsier';
import { SpaceOtter } from './SpaceOtter';
import { SpacePenguin } from './SpacePenguin';
import { SpaceSealPup } from './SpaceSealPup';
import { SpaceAstroBunny } from './SpaceAstroBunny';
import { TrappedFriend } from './TrappedFriend';
import { LunarLemur, type LemurPerchType } from './LunarLemur';
import type { TrappedFriendKind } from './types';
import { decorationBudget } from '../decoration_budget';
import type { LevelConfig } from '../level_config';

export interface FriendSpawnerHost {
    scene: THREE.Scene;
    kitties: SpaceKitty[];
    bunnies: SpaceBunny[];
    lanterns: WishLantern[];
    tarsiers: AstroTarsier[];
    otters: SpaceOtter[];
    penguins: SpacePenguin[];
    sealPups: SpaceSealPup[];
    astroBunnies: SpaceAstroBunny[];
    trappedFriends: TrappedFriend[];
    lemurs: LunarLemur[];
    lemursThisLevel: number;
    readonly MAX_LEMURS_PER_LEVEL: number;
    lastSpawnX: number;
    readonly spawnInterval: number;
    astroBunniesThisSegment: number;
    readonly MAX_ASTRO_BUNNIES_PER_SEGMENT: number;
    spawnKitty(x: number, y: number): SpaceKitty;
    spawnBunny(x: number, y: number): SpaceBunny;
    spawnOtter(x: number, y: number): SpaceOtter;
    spawnPenguin(x: number, y: number): SpacePenguin;
    spawnSealPup(x: number, y: number): SpaceSealPup;
    spawnAstroBunny(x: number, y: number): SpaceAstroBunny | null;
    spawnLantern(x: number, y: number): WishLantern;
}

export function spawnTarsiersNearAnchor(
    host: FriendSpawnerHost,
    anchorPos: THREE.Vector3,
    count: number = 3
): AstroTarsier[] {
    const spawned: AstroTarsier[] = [];
    const cap = Math.min(count, 5);
    for (let i = 0; i < cap; i++) {
        const t = new AstroTarsier(host.scene, anchorPos, i);
        host.tarsiers.push(t);
        spawned.push(t);
    }
    return spawned;
}

export function maybeSpawnLemurOnPerch(
    host: FriendSpawnerHost,
    prop: THREE.Object3D,
    perchType: LemurPerchType,
    levelConfig?: LevelConfig,
    perchOffsetY?: number
): LunarLemur | null {
    const rate = levelConfig?.lunarLemurRate ?? 0;
    if (rate <= 0 || host.lemursThisLevel >= host.MAX_LEMURS_PER_LEVEL) return null;
    if (Math.random() > rate) return null;
    if (!decorationBudget.canSpawn('lunar_lemur')) return null;

    const offsetY = perchOffsetY ?? (perchType === 'gravityAnchor' ? 3.2 : perchType === 'geode' ? 2.4 : 2.0);
    const lemur = new LunarLemur(host.scene, prop.position, perchType, offsetY);
    if (!decorationBudget.reportSpawn('lunar_lemur')) {
        lemur.destroy(host.scene);
        return null;
    }
    host.lemurs.push(lemur);
    host.lemursThisLevel++;
    return lemur;
}

export function spawnTrappedFriend(
    host: FriendSpawnerHost,
    x: number,
    y: number,
    kind?: TrappedFriendKind
): TrappedFriend {
    let chosen = kind;
    if (!chosen) {
        const r = Math.random();
        if (r < 0.08) {
            chosen = 'moonpup';
        } else {
            chosen = (['kitty', 'bunny', 'tarsier', 'otter', 'penguin', 'sealpup', 'astrobunny', 'lemur'] as TrappedFriendKind[])[Math.floor(Math.random() * 8)];
        }
    }
    const friend = new TrappedFriend(host.scene, x, y, chosen);
    host.trappedFriends.push(friend);
    return friend;
}

export function spawnTrappedLemurIsland(
    host: FriendSpawnerHost,
    x: number,
    y: number,
    z: number
): TrappedFriend {
    const island = new THREE.Group();
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x667788, roughness: 0.95 });
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1.1, 0), rockMat);
    rock.scale.set(1.4, 0.55, 1.2);
    island.add(rock);
    island.position.set(x, y, z);
    host.scene.add(island);

    const friend = spawnTrappedFriend(host, x, y + 0.9, 'lemur');
    friend.group.position.z = z;
    return friend;
}

export function spawnTrappedFriendsAlong(
    host: FriendSpawnerHost,
    startX: number,
    length: number,
    count: number
): TrappedFriend[] {
    const spawned: TrappedFriend[] = [];
    for (let i = 0; i < count; i++) {
        const x = startX + (length / (count + 1)) * (i + 1);
        const y = (Math.random() - 0.5) * 16;
        spawned.push(spawnTrappedFriend(host, x, y));
    }
    return spawned;
}

export function maybeSpawnFriends(
    host: FriendSpawnerHost,
    playerX: number,
    levelConfig?: {
        cosmicOtterRate?: number;
        astroPenguinRate?: number;
        stellarSealPupRate?: number;
        astroBunnyRate?: number;
    }
): void {
    if (playerX - host.lastSpawnX > host.spawnInterval) {
        host.lastSpawnX = playerX;
        host.astroBunniesThisSegment = 0;

        const count = 1 + Math.floor(Math.random() * 3);
        const otterWeight = levelConfig?.cosmicOtterRate ?? 0;
        const penguinWeight = levelConfig?.astroPenguinRate ?? 0;
        const sealWeight = levelConfig?.stellarSealPupRate ?? 0;
        const astroBunnyWeight = levelConfig?.astroBunnyRate ?? 0;
        const remaining = Math.max(0, 1 - otterWeight - penguinWeight - sealWeight - astroBunnyWeight);

        for (let i = 0; i < count; i++) {
            const spawnX = playerX + 30 + Math.random() * 40;
            const spawnY = (Math.random() - 0.5) * 15;

            const type = Math.random();
            if (type < otterWeight) {
                host.spawnOtter(spawnX, spawnY);
            } else if (type < otterWeight + penguinWeight) {
                host.spawnPenguin(spawnX, spawnY);
            } else if (type < otterWeight + penguinWeight + sealWeight) {
                host.spawnSealPup(spawnX, spawnY);
            } else if (type < otterWeight + penguinWeight + sealWeight + astroBunnyWeight) {
                host.spawnAstroBunny(spawnX, spawnY);
            } else if (type < otterWeight + penguinWeight + sealWeight + astroBunnyWeight + 0.35 * remaining) {
                host.spawnKitty(spawnX, spawnY);
            } else if (type < otterWeight + penguinWeight + sealWeight + astroBunnyWeight + 0.7 * remaining) {
                host.spawnBunny(spawnX, spawnY);
            } else {
                host.spawnLantern(spawnX, spawnY + 2);
            }
        }
    }
}

export function spawnNearInterestArea(
    host: FriendSpawnerHost,
    x: number,
    y: number,
    type: 'cluster' | 'gap' | 'tunnel' | 'aquatic'
): void {
    switch (type) {
        case 'cluster':
            if (Math.random() < 0.3) {
                host.spawnAstroBunny(x, y + 2);
            } else if (Math.random() < 0.5) {
                host.spawnOtter(x, y + 2);
            } else {
                host.spawnBunny(x, y + 3);
            }
            break;
        case 'gap':
            if (Math.random() < 0.3) {
                host.spawnAstroBunny(x, y);
            } else if (Math.random() < 0.45) {
                host.spawnPenguin(x, y);
            } else if (Math.random() < 0.55) {
                host.spawnSealPup(x, y);
            } else {
                host.spawnLantern(x, y);
            }
            break;
        case 'tunnel':
            host.spawnKitty(x, y);
            break;
        case 'aquatic':
            if (Math.random() < 0.55) {
                host.spawnSealPup(x, y);
            } else {
                host.spawnOtter(x, y + 1);
            }
            break;
    }
}
