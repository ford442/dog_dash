import * as THREE from 'three';
import { AudioSystem } from '../audio_system';
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

export class FriendsManager {
    private scene: THREE.Scene;
    private audio: AudioSystem;
    private particles: ParticleSystem;
    
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

    // Total friends rescued this run (drives the Level 3 "Rescue" objective)
    private rescuedCount: number = 0;

    /** Fired the moment a trapped friend is freed. count = running total rescued. */
    onFriendRescued?: (count: number, position: THREE.Vector3, kind: TrappedFriendKind) => void;

    /** Fired when a Cosmic Otter shares an orb (+cores). */
    onOtterGift?: (position: THREE.Vector3, cores: number) => void;

    /** Fired when an Astro Penguin completes a belly slide (+slide assist). */
    onPenguinSlide?: (position: THREE.Vector3, cores: number, slideAssistDuration: number) => void;

    /** Fired when a Stellar Seal Pup claps to cheer the player on (+glow / heal). */
    onSealClap?: (position: THREE.Vector3, healthRestore?: number) => void;

    /** Fired when an Astro Bunny finishes its lucky double-hop greet. */
    onAstroBunnyLucky?: (position: THREE.Vector3, bonus: number) => void;

    // Cooldowns for audio (prevent spam)
    private lastKittySound: number = 0;
    private lastBunnySound: number = 0;
    private lastLanternSound: number = 0;
    private lastTarsierSound: number = 0;
    private lastOtterSound: number = 0;
    private lastPenguinSound: number = 0;
    private lastSealSound: number = 0;
    private lastAstroBunnySound: number = 0;
    
    // Spawn tracking
    private lastSpawnX: number = 0;
    private spawnInterval: number = 100; // Spawn friends every ~100 units
    private astroBunniesThisSegment: number = 0;
    private readonly MAX_ASTRO_BUNNIES_PER_SEGMENT = 4;
    
    constructor(scene: THREE.Scene, audio: AudioSystem, particles: ParticleSystem) {
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

    /**
     * Spawn 2–5 Astro Tarsiers orbiting a Gravity Anchor.
     * @param anchorPos  World-space centre of the anchor.
     * @param count      How many tarsiers (default 3).
     */
    spawnTarsiersNearAnchor(anchorPos: THREE.Vector3, count: number = 3): AstroTarsier[] {
        const spawned: AstroTarsier[] = [];
        const cap = Math.min(count, 5);
        for (let i = 0; i < cap; i++) {
            const t = new AstroTarsier(this.scene, anchorPos, i);
            this.tarsiers.push(t);
            spawned.push(t);
        }
        return spawned;
    }

    /**
     * Trigger a panic reaction on all tarsiers near a world position
     * (e.g. a projectile passed close to an anchor).
     */
    panicTarsiersNear(worldPos: THREE.Vector3, radius: number = 18): void {
        for (const t of this.tarsiers) {
            if (t.position.distanceTo(worldPos) < radius) {
                t.triggerPanic();
            }
        }
    }

    /**
     * Spawn a single trapped friend (cage/wreckage) awaiting rescue.
     */
    spawnTrappedFriend(x: number, y: number, kind?: TrappedFriendKind): TrappedFriend {
        let chosen = kind;
        if (!chosen) {
            // Moon Pup is a rare "good dog" find - the rest are evenly likely.
            const r = Math.random();
            if (r < 0.08) {
                chosen = 'moonpup';
            } else {
                chosen = (['kitty', 'bunny', 'tarsier', 'otter', 'penguin', 'sealpup', 'astrobunny'] as TrappedFriendKind[])[Math.floor(Math.random() * 7)];
            }
        }
        const friend = new TrappedFriend(this.scene, x, y, chosen);
        this.trappedFriends.push(friend);
        return friend;
    }

    /**
     * Spawn `count` trapped friends spread evenly across [startX, startX + length],
     * used to seed the Level 3 "Rescue" objective.
     */
    spawnTrappedFriendsAlong(startX: number, length: number, count: number): TrappedFriend[] {
        const spawned: TrappedFriend[] = [];
        for (let i = 0; i < count; i++) {
            const x = startX + (length / (count + 1)) * (i + 1);
            const y = (Math.random() - 0.5) * 16;
            spawned.push(this.spawnTrappedFriend(x, y));
        }
        return spawned;
    }

    /**
     * Trigger a cheer reaction on all tarsiers orbiting a specific anchor
     * (e.g. the player completed a clean sling-arc nearby).
     */
    cheerTarsiersNearAnchor(anchorPos: THREE.Vector3, radius: number = 20): void {
        for (const t of this.tarsiers) {
            if (t.anchorPos.distanceTo(anchorPos) < radius) {
                t.triggerCheer();
            }
        }
    }
    
    /**
     * Spawn friends randomly as player progresses
     */
    maybeSpawnFriends(playerX: number, levelConfig?: {
        cosmicOtterRate?: number;
        astroPenguinRate?: number;
        stellarSealPupRate?: number;
        astroBunnyRate?: number;
    }): void {
        if (playerX - this.lastSpawnX > this.spawnInterval) {
            this.lastSpawnX = playerX;
            this.astroBunniesThisSegment = 0;
            
            // Spawn 1-3 friends near this area
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
                    this.spawnOtter(spawnX, spawnY);
                } else if (type < otterWeight + penguinWeight) {
                    this.spawnPenguin(spawnX, spawnY);
                } else if (type < otterWeight + penguinWeight + sealWeight) {
                    this.spawnSealPup(spawnX, spawnY);
                } else if (type < otterWeight + penguinWeight + sealWeight + astroBunnyWeight) {
                    this.spawnAstroBunny(spawnX, spawnY);
                } else if (type < otterWeight + penguinWeight + sealWeight + astroBunnyWeight + 0.35 * remaining) {
                    this.spawnKitty(spawnX, spawnY);
                } else if (type < otterWeight + penguinWeight + sealWeight + astroBunnyWeight + 0.7 * remaining) {
                    this.spawnBunny(spawnX, spawnY);
                } else {
                    this.spawnLantern(spawnX, spawnY + 2);
                }
            }
        }
    }
    
    /**
     * Spawn friends near interesting areas (like asteroid clusters)
     */
    spawnNearInterestArea(x: number, y: number, type: 'cluster' | 'gap' | 'tunnel' | 'aquatic'): void {
        switch (type) {
            case 'cluster':
                if (Math.random() < 0.3) {
                    this.spawnAstroBunny(x, y + 2);
                } else if (Math.random() < 0.5) {
                    this.spawnOtter(x, y + 2);
                } else {
                    this.spawnBunny(x, y + 3);
                }
                break;
            case 'gap':
                if (Math.random() < 0.3) {
                    this.spawnAstroBunny(x, y);
                } else if (Math.random() < 0.45) {
                    this.spawnPenguin(x, y);
                } else if (Math.random() < 0.55) {
                    this.spawnSealPup(x, y);
                } else {
                    this.spawnLantern(x, y);
                }
                break;
            case 'tunnel':
                // Spawn a kitty in tunnels (cute companion)
                this.spawnKitty(x, y);
                break;
            case 'aquatic':
                // Seal pups love open watery zones
                if (Math.random() < 0.55) {
                    this.spawnSealPup(x, y);
                } else {
                    this.spawnOtter(x, y + 1);
                }
                break;
        }
    }

    private isFriendDisturbed(friendPos: THREE.Vector3, projectiles: { active: boolean; mesh: THREE.Mesh }[], radius: number = 14): boolean {
        for (const proj of projectiles) {
            if (!proj.active) continue;
            if (proj.mesh.position.distanceTo(friendPos) < radius) {
                return true;
            }
        }
        return false;
    }
    
    update(dt: number, playerPos: THREE.Vector3, projectiles: { active: boolean; mesh: THREE.Mesh }[] = []): void {
        const now = Date.now();
        
        // Update all kitties
        for (const kitty of this.kitties) {
            const result = kitty.update(dt, playerPos);
            if (result) {
                this.handleInteraction(result, now);
            }
        }
        
        // Update all bunnies
        for (const bunny of this.bunnies) {
            const result = bunny.update(dt, playerPos);
            if (result) {
                this.handleInteraction(result, now);
            }
        }
        
        // Update all lanterns
        for (const lantern of this.lanterns) {
            const result = lantern.update(dt, playerPos);
            if (result) {
                this.handleInteraction(result, now);
                // Auto-pop lanterns when player is close
                if (result.type === 'lantern_pop') {
                    this.popLantern(lantern);
                }
            }
        }

        // Update all tarsiers
        for (const tarsier of this.tarsiers) {
            const result = tarsier.update(dt, playerPos);
            if (result) {
                this.handleInteraction(result, now);
            }
        }

        // Update all otters
        for (const otter of this.otters) {
            const disturbed = this.isFriendDisturbed(otter.position, projectiles);
            const result = otter.update(dt, playerPos, disturbed);
            if (result) {
                this.handleInteraction(result, now);
            }
        }

        // Update all penguins
        for (const penguin of this.penguins) {
            const disturbed = this.isFriendDisturbed(penguin.position, projectiles);
            const result = penguin.update(dt, playerPos, disturbed);
            if (result) {
                this.handleInteraction(result, now);
            }
        }

        // Update all seal pups
        for (const seal of this.sealPups) {
            const disturbed = this.isFriendDisturbed(seal.position, projectiles);
            const result = seal.update(dt, playerPos, disturbed);
            if (result) {
                this.handleInteraction(result, now);
            }
        }

        // Update all astro bunnies
        for (const astroBunny of this.astroBunnies) {
            const disturbed = this.isFriendDisturbed(astroBunny.position, projectiles);
            const result = astroBunny.update(dt, playerPos, disturbed);
            if (result) {
                this.handleInteraction(result, now);
            }
        }

        // Update trapped friends and free any the player has reached
        for (let i = this.trappedFriends.length - 1; i >= 0; i--) {
            const trapped = this.trappedFriends[i];
            const justRescued = trapped.update(dt, playerPos);
            if (justRescued) {
                this.rescuedCount++;

                this.audio.playSequence([
                    { sound: 'twinkle', delay: 0, volume: 0.8 },
                    { sound: 'heart_pop', delay: 0.1, volume: 0.6 }
                ]);
                this.particles.emit(trapped.worldPosition, TRAPPED_FRIEND_COLORS[trapped.kind], 16, 4.0, 0.6, 1.2);

                const member = new FlotillaMember(this.scene, TRAPPED_FRIEND_COLORS[trapped.kind], this.flotilla.length, trapped.kind);
                member.group.position.copy(trapped.worldPosition);
                this.flotilla.push(member);

                this.onFriendRescued?.(this.rescuedCount, trapped.worldPosition.clone(), trapped.kind);

                trapped.destroy(this.scene);
                this.trappedFriends.splice(i, 1);
            }
        }

        // Update the rescued-friend flotilla following the player
        for (const member of this.flotilla) {
            member.update(dt, playerPos);
        }
    }
    
    private handleInteraction(result: InteractionResult, now: number): void {
        switch (result.type) {
            case 'kitty_wave':
                // Play soft meow on wave (with cooldown)
                if (now - this.lastKittySound > 2000) {
                    this.audio.play('twinkle', 0.6);
                    this.lastKittySound = now;
                }
                // Emit sparkle particles
                this.particles.emit(result.position, 0xffd700, 8, 3.0, 0.5, 1.0);
                break;
                
            case 'bunny_heal':
                // Play happy boop sound (with cooldown)
                if (now - this.lastBunnySound > 3000) {
                    this.audio.play('heart_pop', 0.7);
                    this.lastBunnySound = now;
                }
                // Emit heart particles
                this.particles.emit(result.position, 0xff69b4, 12, 4.0, 0.6, 1.5);
                break;
                
            case 'lantern_pop':
                // Sounds handled in popLantern
                break;

            case 'tarsier_cheer':
                // Happy twinkle cheer (with cooldown)
                if (now - this.lastTarsierSound > 1500) {
                    this.audio.play('twinkle', 0.5);
                    this.lastTarsierSound = now;
                }
                // Warm golden burst of sparkles
                this.particles.emit(result.position, 0xffd966, 10, 3.5, 0.5, 1.2);
                break;

            case 'tarsier_panic':
                // Quick scatter sound (with cooldown)
                if (now - this.lastTarsierSound > 1000) {
                    this.audio.play('sparkle', 0.35);
                    this.lastTarsierSound = now;
                }
                // Small puff of dust/spores
                this.particles.emit(result.position, 0xaaddcc, 6, 2.0, 0.3, 0.8);
                break;

            case 'otter_gift':
                if (now - this.lastOtterSound > 2500) {
                    this.audio.playSequence([
                        { sound: 'twinkle', delay: 0, volume: 0.75 },
                        { sound: 'sparkle', delay: 0.08, volume: 0.55 }
                    ]);
                    this.lastOtterSound = now;
                }
                this.particles.emit(result.position, 0xffdd44, 14, 4.5, 0.6, 1.4);
                this.particles.emit(result.position, 0x44ccff, 10, 3.0, 0.5, 1.0);
                this.onOtterGift?.(result.position, result.bonus ?? 1);
                break;

            case 'otter_sploosh':
                this.particles.emit(result.position, 0x44ccff, 5, 2.2, 0.35, 0.7);
                break;

            case 'penguin_slide':
                if (now - this.lastPenguinSound > 2800) {
                    this.audio.playSequence([
                        { sound: 'heart_pop', delay: 0, volume: 0.65 },
                        { sound: 'sparkle', delay: 0.12, volume: 0.5 }
                    ]);
                    this.lastPenguinSound = now;
                }
                this.particles.emit(result.position, 0xffffff, 12, 4.0, 0.5, 1.2);
                this.particles.emit(result.position, 0x88ccff, 10, 3.5, 0.4, 1.0);
                this.onPenguinSlide?.(
                    result.position,
                    result.bonus ?? 1,
                    result.slideAssistDuration ?? 3
                );
                break;

            case 'penguin_ice_trail':
                this.particles.emit(result.position, 0xddeeff, 4, 1.8, 0.25, 0.5);
                this.particles.emit(result.position, 0xaaddff, 3, 1.2, 0.2, 0.4);
                break;

            case 'seal_clap':
                if (now - this.lastSealSound > 2200) {
                    this.audio.playSealClap();
                    this.lastSealSound = now;
                }
                this.particles.emit(result.position, 0xffffff, 5, 1.5, 0.2, 0.5);
                this.particles.emit(result.position, 0xaaddff, 4, 1.2, 0.15, 0.4);
                this.onSealClap?.(result.position, result.healthRestore);
                break;

            case 'seal_bubble_puff':
                this.particles.emit(result.position, 0xffffff, 4, 1.0, 0.12, 0.35);
                this.particles.emit(result.position, 0xcceeff, 3, 0.8, 0.1, 0.3);
                break;

            case 'astro_bunny_lucky':
                if (now - this.lastAstroBunnySound > 2800) {
                    this.audio.playSequence([
                        { sound: 'boing', delay: 0, volume: 0.7 },
                        { sound: 'twinkle', delay: 0.1, volume: 0.65 },
                        { sound: 'sparkle', delay: 0.2, volume: 0.5 }
                    ]);
                    this.lastAstroBunnySound = now;
                }
                this.particles.emit(result.position, 0xffd700, 12, 4.0, 0.45, 1.1);
                this.particles.emit(result.position, 0xfff0f5, 8, 3.0, 0.35, 0.9);
                this.onAstroBunnyLucky?.(result.position, result.bonus ?? 8);
                break;

            case 'astro_bunny_sparkle':
                this.particles.emit(result.position, 0xffeedd, 5, 2.0, 0.2, 0.5);
                this.particles.emit(result.position, 0xffffff, 4, 1.5, 0.12, 0.4);
                break;
        }
    }
    
    checkInteractions(playerPos: THREE.Vector3): InteractionResult[] {
        const results: InteractionResult[] = [];
        
        for (const kitty of this.kitties) {
            const result = kitty.update(0, playerPos);
            if (result) results.push(result);
        }
        
        for (const bunny of this.bunnies) {
            const result = bunny.update(0, playerPos);
            if (result) results.push(result);
        }
        
        for (const lantern of this.lanterns) {
            const result = lantern.update(0, playerPos);
            if (result) results.push(result);
        }
        
        return results;
    }
    
    popLantern(lantern: WishLantern): boolean {
        const now = Date.now();
        
        // Play twinkle chime + firework pop (with cooldown)
        if (now - this.lastLanternSound > 1000) {
            this.audio.playSequence([
                { sound: 'twinkle', delay: 0, volume: 0.8 },
                { sound: 'sparkle', delay: 0.1, volume: 0.6 },
                { sound: 'giggle', delay: 0.2, volume: 0.5 }
            ]);
            this.lastLanternSound = now;
        }
        
        return lantern.pop(this.scene, this.particles);
    }
    
    /**
     * Cleanup friends that are far behind the player
     */
    cleanupFarFriends(playerX: number, buffer: number = 50): void {
        // Remove kitties that are far behind
        for (let i = this.kitties.length - 1; i >= 0; i--) {
            const kitty = this.kitties[i];
            if (kitty.position.x < playerX - buffer) {
                kitty.destroy(this.scene);
                this.kitties.splice(i, 1);
            }
        }
        
        // Remove bunnies that are far behind
        for (let i = this.bunnies.length - 1; i >= 0; i--) {
            const bunny = this.bunnies[i];
            if (bunny.position.x < playerX - buffer) {
                bunny.destroy(this.scene);
                this.bunnies.splice(i, 1);
            }
        }
        
        // Remove lanterns that are far behind
        for (let i = this.lanterns.length - 1; i >= 0; i--) {
            const lantern = this.lanterns[i];
            if (lantern.position.x < playerX - buffer) {
                lantern.destroy(this.scene);
                this.lanterns.splice(i, 1);
            }
        }

        // Remove tarsiers whose anchor has fallen behind
        for (let i = this.tarsiers.length - 1; i >= 0; i--) {
            const tarsier = this.tarsiers[i];
            if (tarsier.anchorPos.x < playerX - buffer) {
                tarsier.destroy(this.scene);
                this.tarsiers.splice(i, 1);
            }
        }

        // Remove otters that are far behind
        for (let i = this.otters.length - 1; i >= 0; i--) {
            const otter = this.otters[i];
            if (otter.position.x < playerX - buffer) {
                otter.destroy(this.scene);
                this.otters.splice(i, 1);
            }
        }

        // Remove penguins that are far behind
        for (let i = this.penguins.length - 1; i >= 0; i--) {
            const penguin = this.penguins[i];
            if (penguin.position.x < playerX - buffer) {
                penguin.destroy(this.scene);
                this.penguins.splice(i, 1);
            }
        }

        // Remove seal pups that are far behind
        for (let i = this.sealPups.length - 1; i >= 0; i--) {
            const seal = this.sealPups[i];
            if (seal.position.x < playerX - buffer) {
                seal.destroy(this.scene);
                this.sealPups.splice(i, 1);
            }
        }

        // Remove astro bunnies that are far behind
        for (let i = this.astroBunnies.length - 1; i >= 0; i--) {
            const bunny = this.astroBunnies[i];
            if (bunny.position.x < playerX - buffer) {
                bunny.destroy(this.scene);
                this.astroBunnies.splice(i, 1);
            }
        }

        // Remove trapped friends the player has flown past without rescuing
        for (let i = this.trappedFriends.length - 1; i >= 0; i--) {
            const trapped = this.trappedFriends[i];
            if (trapped.position.x < playerX - buffer) {
                trapped.destroy(this.scene);
                this.trappedFriends.splice(i, 1);
            }
        }
    }

    /**
     * Number of trapped friends freed so far this run.
     */
    getRescuedCount(): number {
        return this.rescuedCount;
    }

    /**
     * The flotilla cheers: a happy bounce + heart particles from each
     * rescued friend. Call on a clean sling or a close graze dodge.
     */
    cheerFlotilla(position: THREE.Vector3): void {
        if (this.flotilla.length === 0) return;
        for (const member of this.flotilla) {
            member.cheer();
        }
        this.particles.emit(position, 0xff69b4, 6 + this.flotilla.length * 2, 3.0, 0.5, 1.0);
    }

    /**
     * The full flotilla swoops ahead of the rocket for a brief victory
     * fly-by - used when a level's chapter objective is completed.
     */
    triggerVictoryFlyby(duration: number = 2.5): void {
        for (const member of this.flotilla) {
            member.triggerFlyby(duration);
        }
    }

    /**
     * True once the flotilla is large enough to grant passive bonuses
     * (orb magnet radius, etc.)
     */
    hasFullFlotilla(): boolean {
        return this.flotilla.length >= 4;
    }

    /**
     * Get total friend count
     */
    getFriendCount(): { kitties: number; bunnies: number; lanterns: number; tarsiers: number; otters: number; penguins: number; sealPups: number; astroBunnies: number; total: number } {
        return {
            kitties: this.kitties.length,
            bunnies: this.bunnies.length,
            lanterns: this.lanterns.length,
            tarsiers: this.tarsiers.length,
            otters: this.otters.length,
            penguins: this.penguins.length,
            sealPups: this.sealPups.length,
            astroBunnies: this.astroBunnies.length,
            total: this.kitties.length + this.bunnies.length + this.lanterns.length + this.tarsiers.length + this.otters.length + this.penguins.length + this.sealPups.length + this.astroBunnies.length
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
            ...this.trappedFriends.map(friend => friend.group),
            ...this.flotilla.map(friend => friend.group)
        ];
    }

    /**
     * Clear all friends
     */
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
