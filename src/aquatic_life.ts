import * as THREE from 'three';

const AURORA_PALETTE = [0x66ffee, 0xff66cc, 0x9966ff, 0x66ccff];

export type AquaticEvent =
    | { type: 'jellyfish'; position: THREE.Vector3 }
    | { type: 'kelp'; position: THREE.Vector3 }
    | { type: 'plankton'; position: THREE.Vector3 };

interface Jellyfish {
    group: THREE.Group;
    bell: THREE.Mesh;
    tentacles: THREE.Mesh[];
    baseY: number;
    phase: number;
    color: number;
    radius: number;
    touchCooldown: number;
}

interface KelpForest {
    group: THREE.Group;
    fronds: THREE.Mesh[];
    radius: number;
    swimCooldown: number;
}

interface PlanktonSchool {
    points: THREE.Points;
    material: THREE.PointsMaterial;
    position: THREE.Vector3;
    radius: number;
    litCooldown: number;
}

/**
 * Manages aquatic environments: translucent jellyfish,
 * swaying kelp forests, glowing plankton schools, and decorative bubble
 * reefs around rescued friends. Purely additive/cosmetic + soft "swim"
 * bonuses - never damages the player.
 */
export class AquaticLifeManager {
    private scene: THREE.Scene;
    private jellyfish: Jellyfish[] = [];
    private kelpForests: KelpForest[] = [];
    private plankton: PlanktonSchool[] = [];
    private bubbleReefs: THREE.Group[] = [];
    private time: number = 0;

    constructor(scene: THREE.Scene) {
        this.scene = scene;
    }

    /** Seeds jellyfish, kelp forests and plankton schools across an aquatic level span. */
    spawnForLevel(startX: number, length: number) {
        const jellyCount = Math.max(4, Math.floor(length / 220));
        for (let i = 0; i < jellyCount; i++) {
            const x = startX + 40 + Math.random() * length;
            const y = (Math.random() - 0.5) * 18;
            const z = (Math.random() - 0.5) * 12 - 4;
            this.spawnJellyfish(x, y, z);
        }

        const kelpCount = Math.max(3, Math.floor(length / 300));
        for (let i = 0; i < kelpCount; i++) {
            const x = startX + 60 + Math.random() * length;
            const y = -8 - Math.random() * 6;
            const z = (Math.random() - 0.5) * 10 - 6;
            this.spawnKelpForest(x, y, z);
        }

        const planktonCount = Math.max(5, Math.floor(length / 180));
        for (let i = 0; i < planktonCount; i++) {
            const x = startX + 30 + Math.random() * length;
            const y = (Math.random() - 0.5) * 22;
            const z = (Math.random() - 0.5) * 14 - 8;
            this.spawnPlanktonSchool(x, y, z);
        }
    }

    /** Compatibility wrapper for existing Aqua Expanse tuning. */
    spawnForLevel6(startX: number, length: number) {
        this.spawnForLevel(startX, length);
    }

    spawnJellyfish(x: number, y: number, z: number) {
        const colorHex = AURORA_PALETTE[Math.floor(Math.random() * AURORA_PALETTE.length)];
        const group = new THREE.Group();
        group.position.set(x, y, z);

        const bellGeo = new THREE.SphereGeometry(2.2, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55);
        const bellMat = new THREE.MeshPhysicalMaterial({
            color: colorHex,
            transparent: true,
            opacity: 0.35,
            roughness: 0.1,
            transmission: 0.6,
            emissive: colorHex,
            emissiveIntensity: 0.5,
            side: THREE.DoubleSide
        });
        const bell = new THREE.Mesh(bellGeo, bellMat);
        group.add(bell);

        const tentacles: THREE.Mesh[] = [];
        const tentacleCount = 6;
        for (let i = 0; i < tentacleCount; i++) {
            const angle = (i / tentacleCount) * Math.PI * 2;
            const tGeo = new THREE.CylinderGeometry(0.06, 0.12, 3.0, 4);
            const tMat = new THREE.MeshPhysicalMaterial({
                color: colorHex,
                transparent: true,
                opacity: 0.3,
                emissive: colorHex,
                emissiveIntensity: 0.4
            });
            const tentacle = new THREE.Mesh(tGeo, tMat);
            tentacle.position.set(Math.cos(angle) * 1.3, -2.5, Math.sin(angle) * 1.3);
            tentacle.userData.baseAngle = angle;
            group.add(tentacle);
            tentacles.push(tentacle);
        }

        this.scene.add(group);
        this.jellyfish.push({
            group,
            bell,
            tentacles,
            baseY: y,
            phase: Math.random() * Math.PI * 2,
            color: colorHex,
            radius: 2.6,
            touchCooldown: 0
        });
    }

    spawnKelpForest(x: number, y: number, z: number) {
        const group = new THREE.Group();
        group.position.set(x, y, z);

        const fronds: THREE.Mesh[] = [];
        const frondCount = 4 + Math.floor(Math.random() * 3);
        for (let i = 0; i < frondCount; i++) {
            const height = 10 + Math.random() * 6;
            const geo = new THREE.PlaneGeometry(0.8, height, 1, 6);
            // Anchor the bottom edge at the group's local origin
            geo.translate(0, height / 2, 0);
            const mat = new THREE.MeshStandardMaterial({
                color: 0x2a8855,
                emissive: 0x114422,
                emissiveIntensity: 0.4,
                roughness: 0.6,
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 0.85
            });
            const frond = new THREE.Mesh(geo, mat);
            frond.position.set((Math.random() - 0.5) * 2.5, 0, (Math.random() - 0.5) * 2.5);
            frond.rotation.y = Math.random() * Math.PI;
            frond.userData.swayOffset = Math.random() * Math.PI * 2;
            frond.userData.swaySpeed = 0.6 + Math.random() * 0.5;
            group.add(frond);
            fronds.push(frond);
        }

        this.scene.add(group);
        this.kelpForests.push({ group, fronds, radius: 5, swimCooldown: 0 });
    }

    spawnPlanktonSchool(x: number, y: number, z: number) {
        const count = 40;
        const positions = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            positions[i * 3] = (Math.random() - 0.5) * 6;
            positions[i * 3 + 1] = (Math.random() - 0.5) * 6;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 6;
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const material = new THREE.PointsMaterial({
            color: 0x99ffee,
            size: 0.25,
            transparent: true,
            opacity: 0.25,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        const points = new THREE.Points(geo, material);
        points.position.set(x, y, z);

        this.scene.add(points);
        this.plankton.push({ points, material, position: new THREE.Vector3(x, y, z), radius: 9, litCooldown: 0 });
    }

    /** Wraps a position (e.g. a trapped friend) in a decorative glowing bubble dome. */
    spawnBubbleReef(position: THREE.Vector3) {
        const group = new THREE.Group();
        group.position.copy(position);

        const domeGeo = new THREE.SphereGeometry(3.2, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.6);
        const domeMat = new THREE.MeshPhysicalMaterial({
            color: 0x99ddff,
            transparent: true,
            opacity: 0.2,
            roughness: 0.05,
            transmission: 0.8,
            emissive: 0x66aaff,
            emissiveIntensity: 0.3,
            side: THREE.DoubleSide
        });
        const dome = new THREE.Mesh(domeGeo, domeMat);
        group.add(dome);

        // Small rising bubbles inside the reef
        const bubbleCount = 12;
        const positions = new Float32Array(bubbleCount * 3);
        for (let i = 0; i < bubbleCount; i++) {
            positions[i * 3] = (Math.random() - 0.5) * 5;
            positions[i * 3 + 1] = Math.random() * 3 - 2;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 5;
        }
        const bGeo = new THREE.BufferGeometry();
        bGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const bMat = new THREE.PointsMaterial({
            color: 0xccffff,
            size: 0.18,
            transparent: true,
            opacity: 0.6,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        const bubbles = new THREE.Points(bGeo, bMat);
        bubbles.userData.basePositions = positions.slice();
        group.add(bubbles);
        group.userData.bubbles = bubbles;

        this.scene.add(group);
        this.bubbleReefs.push(group);
    }

    /** Animates all aquatic life and returns "encounter" events for this frame. */
    update(delta: number, playerPos: THREE.Vector3): AquaticEvent[] {
        this.time += delta;
        const events: AquaticEvent[] = [];

        for (const jelly of this.jellyfish) {
            jelly.touchCooldown = Math.max(0, jelly.touchCooldown - delta);

            // Gentle bobbing + bell pulse
            const bob = Math.sin(this.time * 0.8 + jelly.phase) * 1.5;
            jelly.group.position.y = jelly.baseY + bob;
            const pulse = Math.sin(this.time * 2.2 + jelly.phase) * 0.15 + 1.0;
            jelly.bell.scale.set(pulse, 1.0 / pulse, pulse);

            for (const tentacle of jelly.tentacles) {
                const baseAngle = tentacle.userData.baseAngle as number;
                tentacle.rotation.x = Math.sin(this.time * 1.5 + baseAngle) * 0.25;
                tentacle.rotation.z = Math.cos(this.time * 1.3 + baseAngle) * 0.25;
            }

            if (jelly.touchCooldown <= 0) {
                const dist = jelly.group.position.distanceTo(playerPos);
                if (dist < jelly.radius + 2) {
                    jelly.touchCooldown = 6;
                    events.push({ type: 'jellyfish', position: jelly.group.position.clone() });
                }
            }
        }

        for (const kelp of this.kelpForests) {
            kelp.swimCooldown = Math.max(0, kelp.swimCooldown - delta);
            for (const frond of kelp.fronds) {
                const offset = frond.userData.swayOffset as number;
                const speed = frond.userData.swaySpeed as number;
                frond.rotation.z = Math.sin(this.time * speed + offset) * 0.3;
            }

            if (kelp.swimCooldown <= 0) {
                const dist = kelp.group.position.distanceTo(playerPos);
                if (dist < kelp.radius) {
                    kelp.swimCooldown = 5;
                    events.push({ type: 'kelp', position: kelp.group.position.clone() });
                }
            }
        }

        for (const school of this.plankton) {
            school.litCooldown = Math.max(0, school.litCooldown - delta);
            const dist = school.position.distanceTo(playerPos);
            const near = dist < school.radius;
            const targetOpacity = near ? 0.9 : 0.25;
            school.material.opacity = THREE.MathUtils.lerp(school.material.opacity, targetOpacity, delta * 3);
            const targetSize = near ? 0.45 : 0.25;
            school.material.size = THREE.MathUtils.lerp(school.material.size, targetSize, delta * 3);

            if (near && school.litCooldown <= 0) {
                school.litCooldown = 8;
                events.push({ type: 'plankton', position: school.position.clone() });
            }
        }

        for (const reef of this.bubbleReefs) {
            const bubbles = reef.userData.bubbles as THREE.Points;
            const positions = bubbles.geometry.attributes.position as THREE.BufferAttribute;
            const base = bubbles.userData.basePositions as Float32Array;
            for (let i = 0; i < positions.count; i++) {
                const riseY = (base[i * 3 + 1] + this.time * 0.8) % 3;
                positions.setY(i, riseY - 2);
            }
            positions.needsUpdate = true;
        }

        return events;
    }

    /** Removes aquatic life that's far behind the player to bound memory use. */
    cleanupFarBehind(playerX: number) {
        const margin = 60;
        this.jellyfish = this.jellyfish.filter(j => {
            if (j.group.position.x < playerX - margin) {
                this.scene.remove(j.group);
                return false;
            }
            return true;
        });
        this.kelpForests = this.kelpForests.filter(k => {
            if (k.group.position.x < playerX - margin) {
                this.scene.remove(k.group);
                return false;
            }
            return true;
        });
        this.plankton = this.plankton.filter(p => {
            if (p.position.x < playerX - margin) {
                this.scene.remove(p.points);
                return false;
            }
            return true;
        });
        this.bubbleReefs = this.bubbleReefs.filter(b => {
            if (b.position.x < playerX - margin) {
                this.scene.remove(b);
                return false;
            }
            return true;
        });
    }

    /** Removes all currently spawned aquatic life so another level can own the lifecycle. */
    clear() {
        for (const jelly of this.jellyfish) {
            this.scene.remove(jelly.group);
        }
        for (const kelp of this.kelpForests) {
            this.scene.remove(kelp.group);
        }
        for (const school of this.plankton) {
            this.scene.remove(school.points);
        }
        for (const reef of this.bubbleReefs) {
            this.scene.remove(reef);
        }

        this.jellyfish = [];
        this.kelpForests = [];
        this.plankton = [];
        this.bubbleReefs = [];
    }
}
