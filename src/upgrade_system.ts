import * as THREE from 'three';

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
        if (!this.playerGroup) return;
        
        this.clearOrbitingIcons();
        
        const config = UPGRADE_CONFIGS[type];
        const iconCount = 3;
        
        for (let i = 0; i < iconCount; i++) {
            const geometry = new THREE.IcosahedronGeometry(0.3, 0);
            const material = new THREE.MeshStandardMaterial({
                color: config.color,
                emissive: config.color,
                emissiveIntensity: 2,
                roughness: 0.2,
                metalness: 0.8
            });
            
            const icon = new THREE.Mesh(geometry, material);
            icon.userData = {
                orbitIndex: i,
                baseOffset: (i / iconCount) * Math.PI * 2
            };
            
            this.orbitingIcons.push(icon);
            this.playerGroup.add(icon);
        }
    }

    private updateOrbitingIcons(time: number) {
        const radius = 1.5;
        const speed = 3;
        
        this.orbitingIcons.forEach((icon, i) => {
            const offset = icon.userData.baseOffset;
            const angle = time * speed + offset;
            
            // Vertical orbit around player
            icon.position.x = Math.cos(angle) * radius;
            icon.position.y = Math.sin(angle * 0.5) * radius * 0.5 + 0.5;
            icon.position.z = Math.sin(angle) * radius * 0.5;
            
            // Rotate the icon itself
            icon.rotation.x += 0.05;
            icon.rotation.y += 0.03;
        });
    }

    private clearOrbitingIcons() {
        this.orbitingIcons.forEach(icon => {
            if (icon.parent) {
                icon.parent.remove(icon);
            }
            icon.geometry.dispose();
            if (Array.isArray(icon.material)) {
                icon.material.forEach(m => m.dispose());
            } else {
                icon.material.dispose();
            }
        });
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

// Pickup orb that enemies drop
export class UpgradePickup {
    mesh: THREE.Mesh;
    upgradeType: UpgradeType;
    active: boolean = true;
    time: number = 0;
    
    constructor(scene: THREE.Scene, position: THREE.Vector3, type: UpgradeType) {
        this.upgradeType = type;
        
        const config = UPGRADE_CONFIGS[type];
        const geometry = new THREE.IcosahedronGeometry(0.5, 1);
        const material = new THREE.MeshStandardMaterial({
            color: config.color,
            emissive: config.color,
            emissiveIntensity: 1,
            roughness: 0.1,
            metalness: 0.9,
            transparent: true,
            opacity: 0.9
        });
        
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(position);
        scene.add(this.mesh);
    }

    update(delta: number, time: number) {
        if (!this.active) return;
        
        this.time += delta;
        
        // Bobbing animation
        this.mesh.position.y += Math.sin(time * 3) * 0.005;
        
        // Rotation
        this.mesh.rotation.x += delta * 2;
        this.mesh.rotation.y += delta * 1.5;
        
        // Pulse scale
        const scale = 1 + Math.sin(time * 5) * 0.1;
        this.mesh.scale.setScalar(scale);
    }

    collect(): UpgradeType {
        this.active = false;
        
        // Collection effect - flash and shrink
        const mat = this.mesh.material as THREE.MeshStandardMaterial;
        mat.emissiveIntensity = 5;
        
        // Animate out
        const shrink = () => {
            this.mesh.scale.multiplyScalar(0.8);
            if (this.mesh.scale.x > 0.01) {
                requestAnimationFrame(shrink);
            } else {
                this.destroy();
            }
        };
        shrink();
        
        return this.upgradeType;
    }

    destroy() {
        if (this.mesh.parent) {
            this.mesh.parent.remove(this.mesh);
        }
        this.mesh.geometry.dispose();
        if (Array.isArray(this.mesh.material)) {
            this.mesh.material.forEach(m => m.dispose());
        } else {
            this.mesh.material.dispose();
        }
    }
}

// Pickup manager
export class PickupManager {
    scene: THREE.Scene;
    pickups: UpgradePickup[] = [];
    spawnChance: number = 0.15; // 15% chance on enemy death

    constructor(scene: THREE.Scene) {
        this.scene = scene;
    }

    trySpawn(position: THREE.Vector3): UpgradePickup | null {
        if (Math.random() > this.spawnChance) return null;
        
        const types: UpgradeType[] = ['cryo', 'pyro', 'rapid', 'pierce'];
        const type = types[Math.floor(Math.random() * types.length)];
        
        const pickup = new UpgradePickup(this.scene, position, type);
        this.pickups.push(pickup);
        
        return pickup;
    }

    update(delta: number, time: number, playerPos: THREE.Vector3): UpgradeType | null {
        let collected: UpgradeType | null = null;
        
        for (let i = this.pickups.length - 1; i >= 0; i--) {
            const pickup = this.pickups[i];
            pickup.update(delta, time);
            
            // Check collection
            const dist = pickup.mesh.position.distanceTo(playerPos);
            if (dist < 1.5 && pickup.active) {
                collected = pickup.collect();
                this.pickups.splice(i, 1);
            }
            
            // Cleanup old pickups
            if (!pickup.active || pickup.mesh.position.x < playerPos.x - 50) {
                if (pickup.active) pickup.destroy();
                this.pickups.splice(i, 1);
            }
        }
        
        return collected;
    }

    reset() {
        this.pickups.forEach(p => p.destroy());
        this.pickups = [];
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
