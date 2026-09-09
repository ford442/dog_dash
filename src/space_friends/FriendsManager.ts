import * as THREE from 'three';
import type { AudioPort } from '../ports';
import { ParticleSystem } from '../particles';
import type { InteractionResult, TrappedFriendKind } from './types';
import { TRAPPED_FRIEND_COLORS } from './types';
import { SpaceKitty } from './SpaceKitty';
import { SpaceBunny } from './SpaceBunny';
import { WishLantern } from './WishLantern';
import { AstroTarsier } from './AstroTarsier';
import { SpaceOtter } from './SpaceOtter';
import { SpacePenguin } from './SpacePenguin';
import { SpaceSealPup } from './SpaceSealPup';
import { SpaceAstroBunny } from './SpaceAstroBunny';
import { TrappedFriend } from './TrappedFriend';
import { FlotillaMember } from './FlotillaMember';
import { LunarLemur, type LemurPerchType } from './LunarLemur';
import { decorationBudget } from '../decoration_budget';
import type { LevelConfig } from '../level_config';
import {
    type FriendSpawnerHost,
    spawnTarsiersNearAnchor,
    maybeSpawnLemurOnPerch,
    spawnTrappedFriend,
    spawnTrappedLemurIsland,
    spawnTrappedFriendsAlong,
    maybeSpawnFriends,
    spawnNearInterestArea
} from './friend_spawning';
import {
    type FriendInteractionHost,
    isFriendDisturbed,
    handleInteraction,
    checkInteractions,
    popLantern,
    cheerFlotilla
} from './friend_interactions';

export class FriendsManager implements FriendSpawnerHost, FriendInteractionHost {
    scene: THREE.Scene;
    audio: AudioPort;
    particles: ParticleSystem;

    kitties: SpaceKitty[] = [];
    bunnies: SpaceBunny[] = [];
    lanterns: WishLantern[] = [];
    tarsiers: AstroTarsier[] = [];
    otters: SpaceOtter[] = [];
    penguins: SpacePenguin[] = [];
    sealPups: SpaceSealPup[] = [];
    astroBunnies: SpaceAstroBunny[] = [];
    trappedFriends: TrappedFriend[] = [];
    flotilla: FlotillaMember[] = [];
    lemurs: LunarLemur[] = [];

    lemursThisLevel = 0;
    readonly MAX_LEMURS_PER_LEVEL = 3;

    private rescuedCount: number = 0;

    onFriendRescued?: (count: number, position: THREE.Vector3, kind: TrappedFriendKind) => void;
    onOtterGift?: (position: THREE.Vector3, cores: number) => void;
    onPenguinSlide?: (position: THREE.Vector3, cores: number, slideAssistDuration: number) => void;
    onSealClap?: (position: THREE.Vector3, healthRestore?: number) => void;
    onAstroBunnyLucky?: (position: THREE.Vector3, bonus: number) => void;
    onLemurHeartGift?: (position: THREE.Vector3) => void;

    lastKittySound = 0;
    lastBunnySound = 0;
    lastLanternSound = 0;
    lastTarsierSound = 0;
    lastOtterSound = 0;
    lastPenguinSound = 0;
    lastSealSound = 0;
    lastAstroBunnySound = 0;
    lastLemurSound = 0;

    lastSpawnX = 0;
    readonly spawnInterval = 100;
    astroBunniesThisSegment = 0;
    readonly MAX_ASTRO_BUNNIES_PER_SEGMENT = 4;

    constructor(scene: THREE.Scene, audio: AudioPort, particles: ParticleSystem) {
        this.scene = scene;
        this.audio = audio;
        this.particles = particles;
    }

    spawnKitty(x: number, y: number): SpaceKitty {
        const kitty = new SpaceKitty(this.scene, x, y);
        this.kitties.push(kitty);
        return kitty;
    }

    spawnBunny(x: number, y: number): SpaceBunny {
        const bunny = new SpaceBunny(this.scene, x, y);
        this.bunnies.push(bunny);
        return bunny;
    }

    spawnOtter(x: number, y: number): SpaceOtter {
        const otter = new SpaceOtter(this.scene, x, y);
        this.otters.push(otter);
        return otter;
    }

    spawnPenguin(x: number, y: number): SpacePenguin {
        const penguin = new SpacePenguin(this.scene, x, y);
        this.penguins.push(penguin);
        return penguin;
    }

    spawnSealPup(x: number, y: number): SpaceSealPup {
        const seal = new SpaceSealPup(this.scene, x, y);
        this.sealPups.push(seal);
        return seal;
    }

    spawnAstroBunny(x: number, y: number): SpaceAstroBunny | null {
        if (this.astroBunniesThisSegment >= this.MAX_ASTRO_BUNNIES_PER_SEGMENT) {
            return null;
        }
        const bunny = new SpaceAstroBunny(this.scene, x, y);
        this.astroBunnies.push(bunny);
        this.astroBunniesThisSegment++;
        return bunny;
    }

    spawnLantern(x: number, y: number): WishLantern {
        const lantern = new WishLantern(this.scene, x, y);
        this.lanterns.push(lantern);
        return lantern;
    }

    spawnTarsiersNearAnchor(anchorPos: THREE.Vector3, count: number = 3): AstroTarsier[] {
        return spawnTarsiersNearAnchor(this, anchorPos, count);
    }

    panicTarsiersNear(worldPos: THREE.Vector3, radius: number = 18): void {
        for (const t of this.tarsiers) {
            if (t.position.distanceTo(worldPos) < radius) {
                t.triggerPanic();
            }
        }
    }

    resetLevelLemurCap(): void {
        this.lemursThisLevel = 0;
    }

    maybeSpawnLemurOnPerch(
        prop: THREE.Object3D,
        perchType: LemurPerchType,
        levelConfig?: LevelConfig,
        perchOffsetY?: number
    ): LunarLemur | null {
        return maybeSpawnLemurOnPerch(this, prop, perchType, levelConfig, perchOffsetY);
    }

    spawnTrappedLemurIsland(x: number, y: number, z: number): TrappedFriend {
        return spawnTrappedLemurIsland(this, x, y, z);
    }

    panicLemursNear(worldPos: THREE.Vector3, radius: number = 20): void {
        for (const lemur of this.lemurs) {
            if (lemur.position.distanceTo(worldPos) < radius) {
                lemur.triggerPanic();
            }
        }
    }

    spawnTrappedFriend(x: number, y: number, kind?: TrappedFriendKind): TrappedFriend {
        return spawnTrappedFriend(this, x, y, kind);
    }

    spawnTrappedFriendsAlong(startX: number, length: number, count: number): TrappedFriend[] {
        return spawnTrappedFriendsAlong(this, startX, length, count);
    }

    cheerTarsiersNearAnchor(anchorPos: THREE.Vector3, radius: number = 20): void {
        for (const t of this.tarsiers) {
            if (t.anchorPos.distanceTo(anchorPos) < radius) {
                t.triggerCheer();
            }
        }
    }

    maybeSpawnFriends(playerX: number, levelConfig?: {
        cosmicOtterRate?: number;
        astroPenguinRate?: number;
        stellarSealPupRate?: number;
        astroBunnyRate?: number;
    }): void {
        maybeSpawnFriends(this, playerX, levelConfig);
    }

    spawnNearInterestArea(x: number, y: number, type: 'cluster' | 'gap' | 'tunnel' | 'aquatic'): void {
        spawnNearInterestArea(this, x, y, type);
    }

    update(dt: number, playerPos: THREE.Vector3, projectiles: { active: boolean; mesh: THREE.Mesh }[] = [], playerVel?: THREE.Vector3): void {
        const now = Date.now();

        for (const kitty of this.kitties) {
            const result = kitty.update(dt, playerPos);
            if (result) handleInteraction(this, result, now);
        }

        for (const bunny of this.bunnies) {
            const result = bunny.update(dt, playerPos);
            if (result) handleInteraction(this, result, now);
        }

        for (const lantern of this.lanterns) {
            const result = lantern.update(dt, playerPos);
            if (result) {
                handleInteraction(this, result, now);
                if (result.type === 'lantern_pop') {
                    this.popLantern(lantern);
                }
            }
        }

        for (const tarsier of this.tarsiers) {
            const result = tarsier.update(dt, playerPos);
            if (result) handleInteraction(this, result, now);
        }

        for (const otter of this.otters) {
            const disturbed = isFriendDisturbed(otter.position, projectiles);
            const result = otter.update(dt, playerPos, disturbed);
            if (result) handleInteraction(this, result, now);
        }

        for (const penguin of this.penguins) {
            const disturbed = isFriendDisturbed(penguin.position, projectiles);
            const result = penguin.update(dt, playerPos, disturbed);
            if (result) handleInteraction(this, result, now);
        }

        for (const seal of this.sealPups) {
            const disturbed = isFriendDisturbed(seal.position, projectiles);
            const result = seal.update(dt, playerPos, disturbed);
            if (result) handleInteraction(this, result, now);
        }

        for (const astroBunny of this.astroBunnies) {
            const disturbed = isFriendDisturbed(astroBunny.position, projectiles);
            const result = astroBunny.update(dt, playerPos, disturbed);
            if (result) handleInteraction(this, result, now);
        }

        const playerSpeed = playerVel ? playerVel.length() : 0;
        for (let i = this.lemurs.length - 1; i >= 0; i--) {
            const lemur = this.lemurs[i];
            const disturbed = isFriendDisturbed(lemur.position, projectiles, 16);
            const result = lemur.update(dt, playerPos, playerSpeed, disturbed);
            if (result) handleInteraction(this, result, now);
            if (lemur.gone) {
                lemur.destroy(this.scene);
                this.lemurs.splice(i, 1);
                decorationBudget.reportDestroy('lunar_lemur');
            }
        }

        for (let i = this.trappedFriends.length - 1; i >= 0; i--) {
            const trapped = this.trappedFriends[i];
            const justRescued = trapped.update(dt, playerPos);
            if (justRescued) {
                this.rescuedCount++;

                if (typeof this.audio.playSequence === 'function') {
                    this.audio.playSequence([
                        { sound: 'twinkle', delay: 0, volume: 0.8 },
                        { sound: 'heart_pop', delay: 0.1, volume: 0.6 }
                    ]);
                } else {
                    this.audio.play('twinkle', 0.8);
                }
                this.particles.emit(trapped.worldPosition, TRAPPED_FRIEND_COLORS[trapped.kind], 16, 4.0, 0.6, 1.2);

                const member = new FlotillaMember(this.scene, TRAPPED_FRIEND_COLORS[trapped.kind], this.flotilla.length, trapped.kind);
                member.group.position.copy(trapped.worldPosition);
                this.flotilla.push(member);

                this.onFriendRescued?.(this.rescuedCount, trapped.worldPosition.clone(), trapped.kind);

                trapped.destroy(this.scene);
                this.trappedFriends.splice(i, 1);
            }
        }

        for (const member of this.flotilla) {
            member.update(dt, playerPos);
        }
    }

    checkInteractions(playerPos: THREE.Vector3): InteractionResult[] {
        return checkInteractions(this, playerPos);
    }

    popLantern(lantern: WishLantern): boolean {
        return popLantern(this, lantern);
    }

    cleanupFarFriends(playerX: number, buffer: number = 50): void {
        for (let i = this.kitties.length - 1; i >= 0; i--) {
            const kitty = this.kitties[i];
            if (kitty.position.x < playerX - buffer) {
                kitty.destroy(this.scene);
                this.kitties.splice(i, 1);
            }
        }

        for (let i = this.bunnies.length - 1; i >= 0; i--) {
            const bunny = this.bunnies[i];
            if (bunny.position.x < playerX - buffer) {
                bunny.destroy(this.scene);
                this.bunnies.splice(i, 1);
            }
        }

        for (let i = this.lanterns.length - 1; i >= 0; i--) {
            const lantern = this.lanterns[i];
            if (lantern.position.x < playerX - buffer) {
                lantern.destroy(this.scene);
                this.lanterns.splice(i, 1);
            }
        }

        for (let i = this.tarsiers.length - 1; i >= 0; i--) {
            const tarsier = this.tarsiers[i];
            if (tarsier.anchorPos.x < playerX - buffer) {
                tarsier.destroy(this.scene);
                this.tarsiers.splice(i, 1);
            }
        }

        for (let i = this.otters.length - 1; i >= 0; i--) {
            const otter = this.otters[i];
            if (otter.position.x < playerX - buffer) {
                otter.destroy(this.scene);
                this.otters.splice(i, 1);
            }
        }

        for (let i = this.penguins.length - 1; i >= 0; i--) {
            const penguin = this.penguins[i];
            if (penguin.position.x < playerX - buffer) {
                penguin.destroy(this.scene);
                this.penguins.splice(i, 1);
            }
        }

        for (let i = this.sealPups.length - 1; i >= 0; i--) {
            const seal = this.sealPups[i];
            if (seal.position.x < playerX - buffer) {
                seal.destroy(this.scene);
                this.sealPups.splice(i, 1);
            }
        }

        for (let i = this.astroBunnies.length - 1; i >= 0; i--) {
            const bunny = this.astroBunnies[i];
            if (bunny.position.x < playerX - buffer) {
                bunny.destroy(this.scene);
                this.astroBunnies.splice(i, 1);
            }
        }

        for (let i = this.lemurs.length - 1; i >= 0; i--) {
            const lemur = this.lemurs[i];
            if (lemur.perchPos.x < playerX - buffer) {
                lemur.destroy(this.scene);
                this.lemurs.splice(i, 1);
                decorationBudget.reportDestroy('lunar_lemur');
            }
        }

        for (let i = this.trappedFriends.length - 1; i >= 0; i--) {
            const trapped = this.trappedFriends[i];
            if (trapped.position.x < playerX - buffer) {
                trapped.destroy(this.scene);
                this.trappedFriends.splice(i, 1);
            }
        }
    }

    getRescuedCount(): number {
        return this.rescuedCount;
    }

    cheerFlotilla(position: THREE.Vector3): void {
        cheerFlotilla(this, position);
    }

    triggerVictoryFlyby(duration: number = 2.5): void {
        for (const member of this.flotilla) {
            member.triggerFlyby(duration);
        }
    }

    hasFullFlotilla(): boolean {
        return this.flotilla.length >= 4;
    }

    getFriendCount(): { kitties: number; bunnies: number; lanterns: number; tarsiers: number; otters: number; penguins: number; sealPups: number; astroBunnies: number; lemurs: number; total: number } {
        return {
            kitties: this.kitties.length,
            bunnies: this.bunnies.length,
            lanterns: this.lanterns.length,
            tarsiers: this.tarsiers.length,
            otters: this.otters.length,
            penguins: this.penguins.length,
            sealPups: this.sealPups.length,
            astroBunnies: this.astroBunnies.length,
            lemurs: this.lemurs.length,
            total: this.kitties.length + this.bunnies.length + this.lanterns.length + this.tarsiers.length + this.otters.length + this.penguins.length + this.sealPups.length + this.astroBunnies.length + this.lemurs.length
        };
    }

    getScannables(): THREE.Object3D[] {
        return [
            ...this.kitties.map(friend => friend.group),
            ...this.bunnies.map(friend => friend.group),
            ...this.lanterns.map(friend => friend.group),
            ...this.tarsiers.map(friend => friend.group),
            ...this.otters.map(friend => friend.group),
            ...this.penguins.map(friend => friend.group),
            ...this.sealPups.map(friend => friend.group),
            ...this.astroBunnies.map(friend => friend.group),
            ...this.lemurs.map(friend => friend.group),
            ...this.trappedFriends.map(friend => friend.group),
            ...this.flotilla.map(friend => friend.group)
        ];
    }

    clear(): void {
        for (const kitty of this.kitties) {
            kitty.destroy(this.scene);
        }
        this.kitties = [];

        for (const bunny of this.bunnies) {
            bunny.destroy(this.scene);
        }
        this.bunnies = [];

        for (const lantern of this.lanterns) {
            lantern.destroy(this.scene);
        }
        this.lanterns = [];

        for (const tarsier of this.tarsiers) {
            tarsier.destroy(this.scene);
        }
        this.tarsiers = [];

        for (const otter of this.otters) {
            otter.destroy(this.scene);
        }
        this.otters = [];

        for (const penguin of this.penguins) {
            penguin.destroy(this.scene);
        }
        this.penguins = [];

        for (const seal of this.sealPups) {
            seal.destroy(this.scene);
        }
        this.sealPups = [];

        for (const astroBunny of this.astroBunnies) {
            astroBunny.destroy(this.scene);
        }
        this.astroBunnies = [];
        this.astroBunniesThisSegment = 0;

        for (const lemur of this.lemurs) {
            lemur.destroy(this.scene);
        }
        this.lemurs = [];
        this.lemursThisLevel = 0;

        for (const trapped of this.trappedFriends) {
            trapped.destroy(this.scene);
        }
        this.trappedFriends = [];

        for (const member of this.flotilla) {
            member.destroy(this.scene);
        }
        this.flotilla = [];
        this.rescuedCount = 0;
    }
}

export default FriendsManager;
