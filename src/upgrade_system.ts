import * as THREE from 'three';
import { gameplayRandom } from './run_seed';
import { decorationBudget } from './decoration_budget';
import { disposeObject } from './utils';
import {
    createUpgradeEmblemMaterial,
    getOrbitIconMaterial,
    getUpgradeEmblemGeometry,
    getUpgradeRingGeometry,
    type WeaponUpgradeId
} from './pickup_art/upgrade_art';

/** Player within this distance of a pickup: the token spins up and leans toward them (visual tell). */
export const UPGRADE_PICKUP_TELL_RANGE = 8;
/** Seconds of upgrade left when the orbiting icons start to blink. */
export const UPGRADE_EXPIRY_BLINK = 2.5;
const ORBIT_ICON_COUNT = 3;
const ORBIT_ICON_SCALE = 0.5;

export type UpgradeType = 'cryo' | 'pyro' | 'rapid' | 'pierce' | 'none';

export interface UpgradeConfig {
    type: UpgradeType;
    name: string;
    duration: number;
    color: number;
    description: string;
}

export const UPGRADE_CONFIGS: Record<UpgradeType, UpgradeConfig> = {
    cryo: {
        type: 'cryo',
        name: 'Cryo Rounds',
        duration: 15,
        color: 0x00ffff,
        description: 'Freezes enemies for 2s, 2x damage to Magma Hearts'
    },
    pyro: {
        type: 'pyro',
        name: 'Pyro Rounds',
        duration: 15,
        color: 0xff4400,
        description: 'Burns enemies for 5 dmg/s, 2x damage to Ice'
    },
    rapid: {
        type: 'rapid',
        name: 'Rapid Fire',
        duration: 12,
        color: 0xffff00,
        description: '2x fire rate, +50% heat generation'
    },
    pierce: {
        type: 'pierce',
        name: 'Piercing',
        duration: 10,
        color: 0xff00ff,
        description: 'Shots penetrate through enemies'
    },
    none: {
        type: 'none',
        name: 'None',
        duration: 0,
        color: 0xffffff,
        description: ''
    }
};

export class UpgradeSystem {
    scene: THREE.Scene;
    
    // Current active upgrade
    activeUpgrade: UpgradeType = 'none';
    upgradeTimer: number = 0;
    
    // Visual orbs around player
    orbitingIcons: THREE.Mesh[] = [];
    playerGroup: THREE.Group | null = null;
    
    // Callbacks
    onUpgradeStart: (type: UpgradeType) => void;
    onUpgradeEnd: (type: UpgradeType) => void;

    constructor(
        scene: THREE.Scene,
        callbacks: {
            onUpgradeStart: (type: UpgradeType) => void;
            onUpgradeEnd: (type: UpgradeType) => void;
        }
    ) {
        this.scene = scene;
        this.onUpgradeStart = callbacks.onUpgradeStart;
        this.onUpgradeEnd = callbacks.onUpgradeEnd;
    }

    setPlayerGroup(playerGroup: THREE.Group) {
        this.playerGroup = playerGroup;
    }

    activateUpgrade(type: UpgradeType) {
        if (type === 'none') return;
        
        // End current upgrade if any
        if (this.activeUpgrade !== 'none') {
            this.endCurrentUpgrade();
        }
        
        this.activeUpgrade = type;
        this.upgradeTimer = UPGRADE_CONFIGS[type].duration;
        
        this.createOrbitingIcons(type);
        this.onUpgradeStart(type);
        
        console.log(`⚡ Upgrade activated: ${UPGRADE_CONFIGS[type].name}`);
    }

    endCurrentUpgrade() {
        const oldUpgrade = this.activeUpgrade;
        this.activeUpgrade = 'none';
        this.upgradeTimer = 0;
        
        this.clearOrbitingIcons();
        this.onUpgradeEnd(oldUpgrade);
        
        console.log(`⚡ Upgrade ended: ${UPGRADE_CONFIGS[oldUpgrade].name}`);
    }

    update(delta: number, time: number) {
        if (this.activeUpgrade === 'none') return;
        
        this.upgradeTimer -= delta;
        
        if (this.upgradeTimer <= 0) {
            this.endCurrentUpgrade();
            return;
        }
        
        // Animate orbiting icons
        this.updateOrbitingIcons(time);
    }

    private createOrbitingIcons(type: UpgradeType) {
        if (!this.playerGroup || type === 'none') return;

        this.clearOrbitingIcons();

        const config = UPGRADE_CONFIGS[type];
        const geometry = getUpgradeEmblemGeometry(type);
        const material = getOrbitIconMaterial(type, config.color);

        for (let i = 0; i < ORBIT_ICON_COUNT; i++) {
            const icon = new THREE.Mesh(geometry, material);
            icon.scale.setScalar(ORBIT_ICON_SCALE);
            icon.userData = {
                orbitIndex: i,
                baseOffset: (i / ORBIT_ICON_COUNT) * Math.PI * 2
            };

            this.orbitingIcons.push(icon);
            this.playerGroup.add(icon);
        }
    }

    /**
     * Orbit the emblems around the player. The icons double as the upgrade
     * timer: one drops out per third of the duration, and the last one
     * blinks faster and faster through the final {@link UPGRADE_EXPIRY_BLINK}s.
     */
    private updateOrbitingIcons(time: number) {
        const radius = 1.5;
        const speed = 3;
        const type = this.activeUpgrade;
        const duration = type === 'none' ? 1 : UPGRADE_CONFIGS[type].duration;
        const shown = Math.ceil((this.upgradeTimer / duration) * ORBIT_ICON_COUNT);
        const blinking = this.upgradeTimer < UPGRADE_EXPIRY_BLINK;
        const blinkRate = 4 + (1 - this.upgradeTimer / UPGRADE_EXPIRY_BLINK) * 8;
        const blinkOn = !blinking || Math.sin(time * blinkRate * Math.PI * 2) > -0.2;

        this.orbitingIcons.forEach((icon, i) => {
            const offset = icon.userData.baseOffset;
            const angle = time * speed + offset;

            // Vertical orbit around player
            icon.position.x = Math.cos(angle) * radius;
            icon.position.y = Math.sin(angle * 0.5) * radius * 0.5 + 0.5;
            icon.position.z = Math.sin(angle) * radius * 0.5;

            icon.visible = i < shown && blinkOn;

            // Emblems keep facing the camera; spin on their own face instead of tumbling.
            if (type === 'cryo' || type === 'rapid') {
                icon.rotation.z += 0.04;
            } else {
                icon.rotation.z = Math.sin(time * 4 + offset) * 0.25;
            }
        });
    }

    private clearOrbitingIcons() {
        // Geometry and material are shared per upgrade; just detach.
        this.orbitingIcons.forEach(icon => icon.removeFromParent());
        this.orbitingIcons = [];
    }

    getModifiedFireRate(baseRate: number): number {
        if (this.activeUpgrade === 'rapid') {
            return baseRate * 0.5; // 2x speed = half interval
        }
        return baseRate;
    }

    getModifiedHeatGeneration(baseHeat: number): number {
        if (this.activeUpgrade === 'rapid') {
            return baseHeat * 1.5; // 50% more heat
        }
        return baseHeat;
    }

    getProjectileColor(): number | null {
        if (this.activeUpgrade === 'none') return null;
        return UPGRADE_CONFIGS[this.activeUpgrade].color;
    }

    isPiercing(): boolean {
        return this.activeUpgrade === 'pierce';
    }

    getActiveTimeRemaining(): number {
        return this.upgradeTimer;
    }

    destroy() {
        this.endCurrentUpgrade();
    }
}

/**
 * Upgrade token that enemies drop: the upgrade's emblem (snowflake, flame,
 * triple bolt, arrow) inside a coloured ring. `mesh` is the holder group; its
 * position is what `PickupManager` measures the 1.5u collection distance
 * against, and the bob below is part of that, so it is left as it was.
 */
export class UpgradePickup {
    mesh: THREE.Group;
    emblem: THREE.Mesh;
    ring: THREE.Mesh;
    material: THREE.MeshStandardMaterial;
    upgradeType: UpgradeType;
    active: boolean = true;
    time: number = 0;
    /** 0..1 eased "player is close" tell. */
    alert: number = 0;
    /** Set once collected: seconds of the pop-and-shrink animation so far. */
    collectTime: number = -1;

    constructor(scene: THREE.Scene, position: THREE.Vector3, type: UpgradeType) {
        this.upgradeType = type;

        const id = (type === 'none' ? 'cryo' : type) as WeaponUpgradeId;
        const config = UPGRADE_CONFIGS[type];
        this.material = createUpgradeEmblemMaterial(config.color);

        this.mesh = new THREE.Group();
        this.emblem = new THREE.Mesh(getUpgradeEmblemGeometry(id), this.material);
        this.ring = new THREE.Mesh(getUpgradeRingGeometry(id, config.color), this.material);
        this.mesh.add(this.ring, this.emblem);
        this.mesh.position.copy(position);
        this.mesh.userData.upgradeType = type;
        scene.add(this.mesh);
    }

    update(delta: number, time: number, playerPos?: THREE.Vector3) {
        if (this.collectTime >= 0) {
            this.updateCollect(delta);
            return;
        }
        if (!this.active) return;

        this.time += delta;

        // Bobbing animation (moves the collection point too — keep as is).
        this.mesh.position.y += Math.sin(time * 3) * 0.005;

        // Tell: when the player is close the token spins up, glows and leans toward them.
        let target = 0;
        let lean = 0;
        if (playerPos) {
            const dx = playerPos.x - this.mesh.position.x;
            const dy = playerPos.y - this.mesh.position.y;
            const dist = Math.hypot(dx, dy);
            target = THREE.MathUtils.clamp(1 - dist / UPGRADE_PICKUP_TELL_RANGE, 0, 1);
            lean = THREE.MathUtils.clamp(dy * 0.08, -0.35, 0.35);
        }
        this.alert += (target - this.alert) * Math.min(1, delta * 6);
        this.pose(delta, this.time, this.alert, lean);
    }

    /** Shared with the gallery: idle spin / sway, ring speed and glow from `alert`. */
    pose(delta: number, t: number, alert: number, lean = 0) {
        const type = this.upgradeType;
        if (type === 'cryo') {
            this.emblem.rotation.z += delta * (0.8 + alert * 3);
        } else if (type === 'rapid') {
            this.emblem.rotation.z = Math.sin(t * (6 + alert * 10)) * 0.12;
            this.emblem.position.x = Math.sin(t * 18) * 0.02 * (1 + alert * 2);
        } else if (type === 'pyro') {
            const flick = Math.sin(t * 13) * 0.05 + Math.sin(t * 7.3) * 0.04;
            this.emblem.scale.set(1 - flick * 0.5, 1 + flick + alert * 0.08, 1);
        } else {
            // Pierce: the arrow aims and twitches forward.
            this.emblem.position.x = Math.max(0, Math.sin(t * (2.5 + alert * 4))) * (0.05 + alert * 0.06);
        }
        this.ring.rotation.z -= delta * (0.6 + alert * 4);
        this.ring.rotation.y = Math.sin(t * 1.3) * 0.35;
        this.mesh.rotation.z = lean;
        const pulse = 1 + Math.sin(t * 5) * (0.05 + alert * 0.05);
        this.mesh.scale.setScalar(pulse * (1 + alert * 0.15));
        this.material.emissiveIntensity = 0.55 + alert * 0.9 + Math.max(0, Math.sin(t * 5)) * 0.2;
    }

    collect(): UpgradeType {
        this.active = false;
        this.collectTime = 0;
        this.material.emissiveIntensity = 5;
        return this.upgradeType;
    }

    /** Pop then shrink, driven by the sim delta (no requestAnimationFrame). Returns true when done. */
    updateCollect(delta: number): boolean {
        if (this.collectTime < 0) return true;
        this.collectTime += delta;
        const t = this.collectTime / 0.3;
        if (t >= 1) {
            this.destroy();
            return true;
        }
        const pop = t < 0.25 ? 1 + t * 1.6 : 1.4 * (1 - (t - 0.25) / 0.75);
        this.mesh.scale.setScalar(Math.max(0.01, pop));
        this.emblem.rotation.z += delta * 20;
        return false;
    }

    destroy() {
        this.collectTime = -1;
        this.mesh.removeFromParent();
        disposeObject(this.mesh);
    }
}

// Pickup manager
export class PickupManager {
    scene: THREE.Scene;
    pickups: UpgradePickup[] = [];
    /** Collected tokens still playing their pop-and-shrink. */
    collecting: UpgradePickup[] = [];
    spawnChance: number = 0.15; // 15% chance on enemy death

    constructor(scene: THREE.Scene) {
        this.scene = scene;
    }

    trySpawn(position: THREE.Vector3): UpgradePickup | null {
        if (gameplayRandom('pickups') > this.spawnChance) return null;

        const types: UpgradeType[] = ['cryo', 'pyro', 'rapid', 'pierce'];
        const type = types[Math.floor(gameplayRandom('pickups') * types.length)];

        const pickup = new UpgradePickup(this.scene, position, type);
        this.pickups.push(pickup);

        return pickup;
    }

    update(delta: number, time: number, playerPos: THREE.Vector3): UpgradeType | null {
        let collected: UpgradeType | null = null;

        for (let i = this.collecting.length - 1; i >= 0; i--) {
            if (this.collecting[i].updateCollect(delta)) this.collecting.splice(i, 1);
        }

        for (let i = this.pickups.length - 1; i >= 0; i--) {
            const pickup = this.pickups[i];
            pickup.update(delta, time, playerPos);

            // Check collection
            const dist = pickup.mesh.position.distanceTo(playerPos);
            if (dist < 1.5 && pickup.active) {
                collected = pickup.collect();
                this.pickups.splice(i, 1);
                this.collecting.push(pickup);
                continue;
            }

            // Cleanup old pickups
            if (!pickup.active || pickup.mesh.position.x < playerPos.x - 50) {
                if (pickup.active) pickup.destroy();
                this.pickups.splice(i, 1);
            }
        }

        decorationBudget.syncCount('upgrade_pickups', this.pickups.length + this.collecting.length);
        return collected;
    }

    reset() {
        this.pickups.forEach(p => p.destroy());
        this.collecting.forEach(p => p.destroy());
        this.pickups = [];
        this.collecting = [];
        decorationBudget.syncCount('upgrade_pickups', 0);
    }
}

// Heat system for weapon
export class HeatSystem {
    currentHeat: number = 0;
    maxHeat: number = 100;
    overheated: boolean = false;
    overheatTimer: number = 0;
    
    // Config
    heatPerShot: number = 8;
    dissipationRate: number = 10; // per second
    overheatDuration: number = 3; // seconds

    addHeat(amount: number): boolean {
        if (this.overheated) return false;
        
        this.currentHeat += amount;
        
        if (this.currentHeat >= this.maxHeat) {
            this.currentHeat = this.maxHeat;
            this.triggerOverheat();
            return false; // Cannot fire
        }
        
        return true; // Can fire
    }

    update(delta: number) {
        if (this.overheated) {
            this.overheatTimer -= delta;
            if (this.overheatTimer <= 0) {
                this.overheated = false;
                this.currentHeat = this.maxHeat * 0.5; // Start at half after cooldown
            }
        } else {
            // Dissipate heat
            this.currentHeat = Math.max(0, this.currentHeat - this.dissipationRate * delta);
        }
    }

    private triggerOverheat() {
        this.overheated = true;
        this.overheatTimer = this.overheatDuration;
        console.log('🔥 WEAPON OVERHEATED!');
    }

    getHeatPercent(): number {
        return this.currentHeat / this.maxHeat;
    }

    canFire(): boolean {
        return !this.overheated;
    }

    reset() {
        this.currentHeat = 0;
        this.overheated = false;
        this.overheatTimer = 0;
    }
}
