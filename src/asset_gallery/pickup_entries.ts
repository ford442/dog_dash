/**
 * Gallery entries for what the player collects, fires, wears and slings
 * (issue: pickups, power-ups and projectiles as game assets), plus the
 * placeholder rocket. Each entry goes through the real classes where they
 * stand alone (`UpgradePickup`, `UpgradeSystem`, `Projectile`,
 * `SlingableObjectSystem`), so the gallery shows what the game spawns.
 *
 * State mapping:
 * - **idle**: resting loop.
 * - **telegraph**: pickups / slingables — player within the tell range;
 *   power-ups / orbit icons — the last seconds of the timer (expiry blink).
 * - **hit**: pickups — collect pop; projectiles — muzzle pop-in on re-fire;
 *   slingables — tethered (puffball inflating); shield — bounce; butterflies —
 *   one leaves per blocked hit.
 */

import * as THREE from 'three';
import { UpgradePickup, UpgradeSystem, UPGRADE_CONFIGS, UPGRADE_PICKUP_TELL_RANGE, type UpgradeType } from '../upgrade_system';
import { Projectile } from '../weapons';
import { PROJECTILE_KINDS, WEAPON_UPGRADE_IDS, type ProjectileKind } from '../pickup_art/upgrade_art';
import { buildPowerUpRig, BUTTERFLY_ESCORT_COUNT, POWERUP_EXPIRY_BLINK, SHIELD_RADIUS } from '../pickup_art/powerup_rigs';
import { POWER_UP_CONFIGS, PowerUpType } from '../powerup_manager/types';
import { SlingableObjectSystem, type SlingableKind } from '../slingable_objects';
import { SLINGABLE_ART_KINDS, SLINGABLE_LABELS } from '../pickup_art/slingable_art';
import { createPlaceholderRocketModel } from '../pickup_art/placeholder_rocket';
import type { DebrisSystem, ParticleSystem } from '../particles';
import { disposeObject } from '../utils';
import { registerGalleryEntries, type GalleryContext, type GalleryEntry } from './registry';

const noopParticles = { emit: () => {} } as unknown as ParticleSystem;
const noopDebris = { emit: () => {} } as unknown as DebrisSystem;

/** Rocket lying along +X as in game (player_update sets rotation.z = -π/2). */
function rocketModel(): THREE.Group {
    const holder = new THREE.Group();
    const model = createPlaceholderRocketModel();
    model.rotation.z = -Math.PI / 2;
    holder.add(model);
    return holder;
}

/** Seconds left on a timer of `duration` for the gallery state. */
function galleryTimeLeft(ctx: GalleryContext, t: number, duration: number): number {
    if (ctx.mode === 'telegraph') return POWERUP_EXPIRY_BLINK - (t % (POWERUP_EXPIRY_BLINK + 0.6)) + 0.3;
    return duration;
}

// ---------------------------------------------------------------------------
// Weapon-upgrade tokens + orbit icons
// ---------------------------------------------------------------------------

const UPGRADE_NOTES: Record<string, string> = {
    cryo: 'Snowflake. Spins up and leans to the player inside 8u.',
    pyro: 'Flame. Flickers; flares inside 8u.',
    rapid: 'Triple bolt. Jitters faster inside 8u.',
    pierce: 'Arrow. Twitches forward inside 8u.'
};

function upgradePickupEntry(type: Exclude<UpgradeType, 'none'>): GalleryEntry {
    return {
        id: `upgrade_pickup_${type}`,
        label: `Upgrade token — ${UPGRADE_CONFIGS[type].name}`,
        category: 'pickup',
        note: UPGRADE_NOTES[type],
        build: () => {
            const scene = new THREE.Scene();
            let pickup = new UpgradePickup(scene, new THREE.Vector3(), type);
            pickup.mesh.removeFromParent();
            const holder = new THREE.Group();
            holder.add(pickup.mesh);
            let lastCollect = -1;
            return {
                object: holder,
                update: (dt, t, ctx) => {
                    if (ctx.mode === 'hit') {
                        const cycle = Math.floor(t / 1.2);
                        if (cycle !== lastCollect) {
                            lastCollect = cycle;
                            pickup.destroy();
                            pickup = new UpgradePickup(scene, new THREE.Vector3(), type);
                            pickup.mesh.removeFromParent();
                            holder.add(pickup.mesh);
                        }
                        if (t % 1.2 > 0.45 && pickup.active) pickup.collect();
                        if (!pickup.active) pickup.updateCollect(dt);
                        else pickup.pose(dt, t, 0);
                        return;
                    }
                    if (!pickup.active) return;
                    const alert = ctx.mode === 'telegraph' ? 1 - 2 / UPGRADE_PICKUP_TELL_RANGE : 0;
                    pickup.pose(dt, t, alert, ctx.mode === 'telegraph' ? 0.2 : 0);
                },
                hitboxes: () => [{ x: 0, y: 0, radius: 1.5, weak: false }],
                dispose: () => pickup.destroy()
            };
        }
    };
}

const orbitIconsEntry: GalleryEntry = {
    id: 'upgrade_orbit_icons',
    label: 'Upgrade orbit icons (timer gauge)',
    category: 'pickup',
    note: 'Cycles cryo → pyro → rapid → pierce. One icon drops per third of the timer; blinks in the last 2.5 s.',
    build: () => {
        const scene = new THREE.Scene();
        const player = new THREE.Group();
        player.add(rocketModel());
        const system = new UpgradeSystem(scene, { onUpgradeStart: () => {}, onUpgradeEnd: () => {} });
        system.setPlayerGroup(player);
        let current = -1;
        return {
            object: player,
            update: (_dt, t, ctx) => {
                const idx = Math.floor(t / 5) % WEAPON_UPGRADE_IDS.length;
                const type = WEAPON_UPGRADE_IDS[idx];
                if (idx !== current) {
                    current = idx;
                    system.activateUpgrade(type);
                }
                const duration = UPGRADE_CONFIGS[type].duration;
                const phase = (t % 5) / 5;
                // Idle drains the full timer over the 5 s cycle; telegraph shows the last 2.5 s.
                system.upgradeTimer = ctx.mode === 'telegraph' ? 2.5 * (1 - phase) + 0.01 : duration * (1 - phase) + 0.01;
                system.update(0, t);
            },
            dispose: () => {
                system.destroy();
                disposeObject(player);
            }
        };
    }
};

// ---------------------------------------------------------------------------
// Projectiles
// ---------------------------------------------------------------------------

const PROJECTILE_LABELS: Record<ProjectileKind, string> = {
    plasma: 'Bolt — plasma (no upgrade)',
    cryo: 'Bolt — cryo ice shard',
    pyro: 'Bolt — pyro fireball',
    rapid: 'Bolt — rapid stream',
    pierce: 'Bolt — piercing needle'
};

function projectileEntry(kind: ProjectileKind): GalleryEntry {
    return {
        id: `projectile_${kind}`,
        label: PROJECTILE_LABELS[kind],
        category: 'projectile',
        note: 'Opaque bolt (silhouette) + additive trail. Hitbox r 0.5 for every kind.',
        build: () => {
            const scene = new THREE.Scene();
            const proj = new Projectile(scene);
            proj.mesh.removeFromParent();
            proj.light.intensity = 0.5;
            const fire = () => {
                proj.spawn(new THREE.Vector3(), new THREE.Vector3(1e-4, 0, 0), kind);
                proj.velocity.set(0, 0, 0);
            };
            fire();
            proj.update(0.3); // fully grown for framing; 'hit' re-fires to show the pop-in
            let lastFire = 0;
            return {
                object: proj.mesh,
                update: (dt, t, ctx) => {
                    if (ctx.mode === 'hit' && Math.floor(t / 1.2) !== lastFire) {
                        lastFire = Math.floor(t / 1.2);
                        fire();
                    }
                    proj.update(dt);
                    proj.mesh.position.set(0, 0, 0);
                    proj.light.intensity = 0.5;
                },
                hitboxes: () => [{ x: 0, y: 0, radius: proj.radius, weak: true }],
                dispose: () => disposeObject(proj.mesh)
            };
        }
    };
}

// ---------------------------------------------------------------------------
// Power-up attachments
// ---------------------------------------------------------------------------

const POWERUP_NOTES: Partial<Record<PowerUpType, string>> = {
    [PowerUpType.RAINBOW_COMET_TAIL]: 'Rainbow streamers; the tail shortens as the timer drains.',
    [PowerUpType.FLOWER_CROWN_BOOST]: 'Wreath of six flowers on top of the rocket.',
    [PowerUpType.BUBBLEGUM_SHIELD]: 'Gum bubble: rim, gloss, heart knot. Hit = bounce wobble + rim flash.',
    [PowerUpType.TWINKLE_STAR_MAGNET]: 'Horseshoe magnet; pull waves stream into the poles.',
    [PowerUpType.UNICORN_HORN_BLAST]: 'Spiral horn on the nose, glows in pulses. (Had no visual before.)',
    [PowerUpType.DREAM_CLOUD_CARPET]: 'Sleepy cloud with a rainbow hem; breathes and bobs.',
    [PowerUpType.LULLABY_LANTERN]: 'Paper lantern swings and sings music notes.',
    [PowerUpType.PUPPY_HUG_HUG]: 'Ring of hearts + big heart with a heartbeat.',
    [PowerUpType.FAIRY_DOG_WINGS]: 'Reference asset (drawn wing shapes); unchanged.',
    [PowerUpType.MOONBEAM_SLIDE]: 'Silver slide to a sleepy crescent moon; speed streaks.',
    [PowerUpType.FAIRY_GODMOTHER_SPARKLE]: 'Tiny fairy dog; wand star charges before the gift.',
    [PowerUpType.CANDY_CANE_VORTEX]: 'Six striped candy canes whirling.',
    [PowerUpType.STARLIGHT_TIARA]: 'Gold tiara with five stars; gems twinkle (invincible).',
    [PowerUpType.BUTTERFLY_ESCORT]: 'Three butterflies = three blocked hits. Hit = one leaves.',
    [PowerUpType.MAGIC_PAINTBRUSH]: 'Wooden brush, rainbow-cycling dripping tip.',
    [PowerUpType.BEST_FRIEND_FOREVER_AURA]: 'Aura rings + two friend stars chasing.'
};

function powerUpEntry(type: PowerUpType): GalleryEntry {
    const cfg = POWER_UP_CONFIGS[type];
    return {
        id: `powerup_${type}`,
        label: `${cfg.icon} ${cfg.name}`,
        category: 'powerup',
        note: POWERUP_NOTES[type],
        build: () => {
            const holder = rocketModel();
            const rig = buildPowerUpRig(type);
            holder.add(rig.root);
            let bounce = 0;
            let lastHit = -1;
            return {
                object: holder,
                update: (dt, t, ctx) => {
                    if (ctx.mode === 'hit') {
                        const cycle = Math.floor(t / 1.2);
                        if (cycle !== lastHit) {
                            lastHit = cycle;
                            bounce = 0.35;
                            if (rig.butterflies) {
                                const gone = cycle % (BUTTERFLY_ESCORT_COUNT + 1);
                                rig.butterflies.forEach((b, i) => { b.visible = i < BUTTERFLY_ESCORT_COUNT - gone; });
                            }
                        }
                    } else if (rig.butterflies) {
                        rig.butterflies.forEach((b) => { b.visible = true; });
                    }
                    rig.update({ dt, t, timeLeft: galleryTimeLeft(ctx, t, cfg.duration), duration: cfg.duration, bounce });
                    bounce = Math.max(0, bounce - dt);
                },
                hitboxes: () => type === PowerUpType.BUBBLEGUM_SHIELD ? [{ x: 0, y: 0, radius: SHIELD_RADIUS, weak: false }] : [],
                dispose: () => disposeObject(holder)
            };
        }
    };
}

// ---------------------------------------------------------------------------
// Slingables
// ---------------------------------------------------------------------------

const SLINGABLE_NOTES: Record<SlingableKind, string> = {
    rock: 'Googly eyes + eye-bolt tow point. Squash-bounce in range, glow when tethered.',
    chromaRock: 'Stone husk + crystal cluster; crystals cycle hue, swell in range.',
    puffball: 'Face widens in range; gasps while inflating (hit = tethered).',
    tetherSprite: 'Paper wings flap faster in range / tethered; hook on top.',
    wreckingBall: 'Studs, hazard band, chain stub.',
    toyRocket: 'Reference asset (kept as is).'
};

function slingableEntry(kind: SlingableKind): GalleryEntry {
    return {
        id: `slingable_${kind}`,
        label: SLINGABLE_LABELS[kind],
        category: 'slingable',
        note: SLINGABLE_NOTES[kind],
        build: () => {
            const scene = new THREE.Scene();
            const system = new SlingableObjectSystem(scene, noopParticles, noopDebris);
            const obj = system.createObject(new THREE.Vector3(), {
                kind,
                radius: 1.2,
                mass: 2,
                velocity: new THREE.Vector3(),
                toyVariant: kind === 'toyRocket' ? 'littleFlag' : undefined
            });
            obj.group.removeFromParent();
            const far = new THREE.Vector3(1000, 0, 0);
            const near = new THREE.Vector3(5, 1, 0);
            return {
                object: obj.group,
                update: (dt, t, ctx) => {
                    if (!obj.active) return;
                    const tethered = ctx.mode === 'hit';
                    system.setLatchedTarget(tethered ? obj.group : null);
                    if (kind === 'puffball') obj.inflateTimer = tethered ? ((t % 1.4) / 1.4) * 0.4 : undefined;
                    system.update(dt, 0, ctx.mode === 'idle' ? far : near);
                    obj.group.position.set(0, 0, 0);
                    if (kind === 'puffball' && !tethered) obj.group.scale.setScalar(1);
                },
                hitboxes: () => [{ x: 0, y: 0, radius: obj.radius, weak: false }],
                dispose: () => system.dispose()
            };
        }
    };
}

// ---------------------------------------------------------------------------
// Placeholder rocket
// ---------------------------------------------------------------------------

const placeholderRocketEntry: GalleryEntry = {
    id: 'player_placeholder_rocket',
    label: 'Placeholder rocket (rocket.glb fallback)',
    category: 'player',
    note: 'Nose, porthole, four fins, nozzle. Nose +X as in game.',
    build: () => {
        const holder = rocketModel();
        return { object: holder, dispose: () => disposeObject(holder) };
    }
};

registerGalleryEntries(
    ...WEAPON_UPGRADE_IDS.map(upgradePickupEntry),
    orbitIconsEntry,
    ...PROJECTILE_KINDS.map(projectileEntry),
    ...(Object.values(PowerUpType) as PowerUpType[]).map(powerUpEntry),
    ...[...SLINGABLE_ART_KINDS, 'toyRocket' as const].map(slingableEntry),
    placeholderRocketEntry
);
