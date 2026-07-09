import * as THREE from 'three';
import { TRAPPED_FRIEND_COLORS, type TrappedFriendKind } from './types';

export class TrappedFriend {
    group: THREE.Group;
    position: THREE.Vector3;
    kind: TrappedFriendKind;
    rescued: boolean = false;
    time: number = 0;

    readonly RESCUE_DISTANCE = 7;

    private cage: THREE.Group;
    private beacon: THREE.PointLight;

    constructor(scene: THREE.Scene, x: number, y: number, kind: TrappedFriendKind = 'kitty') {
        this.position = new THREE.Vector3(x, y, 0);
        this.kind = kind;
        this.group = new THREE.Group();
        this.group.position.copy(this.position);
        this.group.userData.speciesId = kind === 'moonpup'
            ? 'moonPup'
            : kind === 'otter'
                ? 'trappedOtter'
                : kind === 'sealpup'
                    ? 'trappedSealPup'
                    : kind === 'astrobunny'
                        ? 'trappedAstroBunny'
                        : kind === 'lemur'
                            ? 'trappedLemur'
                            : `trapped${kind.charAt(0).toUpperCase()}${kind.slice(1)}`;

        // Occupant - the trapped friend, glowing softly inside the wreckage
        const occupantGeo = new THREE.SphereGeometry(0.35, 12, 12);
        const occupantMat = new THREE.MeshStandardMaterial({
            color: TRAPPED_FRIEND_COLORS[kind],
            emissive: TRAPPED_FRIEND_COLORS[kind],
            emissiveIntensity: 0.4,
            roughness: 0.6
        });
        const occupant = new THREE.Mesh(occupantGeo, occupantMat);
        this.group.add(occupant);

        // Cage - rotating wreckage struts trapping the friend
        this.cage = new THREE.Group();
        const barGeo = new THREE.CylinderGeometry(0.06, 0.06, 1.6, 6);
        const barMat = new THREE.MeshStandardMaterial({
            color: 0x888899,
            metalness: 0.7,
            roughness: 0.4
        });
        const barCount = 6;
        for (let i = 0; i < barCount; i++) {
            const bar = new THREE.Mesh(barGeo, barMat);
            const angle = (i / barCount) * Math.PI * 2;
            bar.position.set(Math.cos(angle) * 0.7, Math.sin(angle) * 0.3, Math.sin(angle) * 0.7);
            bar.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
            this.cage.add(bar);
        }
        this.group.add(this.cage);

        // Distress beacon - pulsing light to draw the player's attention
        this.beacon = new THREE.PointLight(0xff6644, 1.2, 6);
        this.beacon.position.set(0, 0.8, 0);
        this.group.add(this.beacon);

        scene.add(this.group);
    }

    /** Returns true the moment the player rescues this friend */
    update(dt: number, playerPos: THREE.Vector3): boolean {
        if (this.rescued) return false;
        this.time += dt;

        // Gentle bob + slowly rotating wreckage conveys "trapped and drifting"
        this.group.position.y = this.position.y + Math.sin(this.time * 1.5) * 0.4;
        this.cage.rotation.y += dt * 0.8;
        this.cage.rotation.x += dt * 0.3;

        // Pulse the distress beacon
        this.beacon.intensity = 0.8 + Math.sin(this.time * 6) * 0.6;

        const dist = this.group.position.distanceTo(playerPos);
        if (dist < this.RESCUE_DISTANCE) {
            this.rescued = true;
            return true;
        }
        return false;
    }

    get worldPosition(): THREE.Vector3 {
        return this.group.position;
    }

    destroy(scene: THREE.Scene): void {
        scene.remove(this.group);
        this.group.traverse(child => {
            if (child instanceof THREE.Mesh) {
                child.geometry?.dispose();
                if (Array.isArray(child.material)) {
                    child.material.forEach(m => m.dispose());
                } else {
                    child.material?.dispose();
                }
            }
        });
    }
}
