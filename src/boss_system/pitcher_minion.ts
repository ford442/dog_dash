import * as THREE from 'three';
import { decorationBudget } from '../decoration_budget';

/** Smaller orbiting pitcher minion — destroying one shaves 10% off the main boss. */
export class PitcherMinion {
    group: THREE.Group;
    orbitAngle: number;
    orbitRadius: number;
    orbitSpeed: number;
    health = 30;
    alive = true;

    constructor(parent: THREE.Group, index: number, total: number) {
        this.orbitAngle = (index / total) * Math.PI * 2;
        this.orbitRadius = 28 + Math.random() * 12;
        this.orbitSpeed = 0.25 + Math.random() * 0.15;

        this.group = new THREE.Group();
        const body = new THREE.Mesh(
            new THREE.CapsuleGeometry(1.8, 3, 6, 8),
            new THREE.MeshStandardMaterial({
                color: 0x2a1040,
                emissive: 0x660044,
                emissiveIntensity: 0.5,
                roughness: 0.85
            })
        );
        body.rotation.z = Math.PI / 2;
        this.group.add(body);

        const mouth = new THREE.Mesh(
            new THREE.ConeGeometry(1.2, 2, 12, 1, true),
            new THREE.MeshStandardMaterial({
                color: 0x110011,
                emissive: 0xff0044,
                emissiveIntensity: 0.8,
                side: THREE.DoubleSide
            })
        );
        mouth.rotation.z = -Math.PI / 2;
        mouth.position.x = 1.5;
        this.group.add(mouth);

        parent.add(this.group);
        decorationBudget.reportSpawn('star_eater_minions');
    }

    update(delta: number, center: THREE.Vector3, time: number): void {
        if (!this.alive) return;
        this.orbitAngle += delta * this.orbitSpeed;
        this.group.position.set(
            center.x + Math.cos(this.orbitAngle) * this.orbitRadius,
            center.y + Math.sin(this.orbitAngle) * this.orbitRadius * 0.55,
            center.z + Math.sin(time * 0.7 + this.orbitAngle) * 4
        );
        this.group.lookAt(center);
    }

    takeDamage(amount: number): boolean {
        if (!this.alive) return false;
        this.health -= amount;
        if (this.health <= 0) {
            this.alive = false;
            this.group.visible = false;
            decorationBudget.reportDestroy('star_eater_minions');
            return true;
        }
        return false;
    }

    getHitbox(): { x: number; y: number; radius: number } {
        return {
            x: this.group.position.x,
            y: this.group.position.y,
            radius: 2.5
        };
    }

    destroy(): void {
        if (this.alive) {
            decorationBudget.reportDestroy('star_eater_minions');
            this.alive = false;
        }
    }
}
