import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import {
    time,
    vec3,
    vec4,
    float,
    sin,
    cos,
    mix,
    smoothstep,
    length,
    positionLocal,
    normalView,
    attribute
} from 'three/tsl';
import { DEPTH_LAYERS, randomZInRange } from './depth_layers';
import type { ParticleSystem } from './particles';
import type { BubbleCoralEnvironmentConfig } from './level_config';
import type { BubbleCoralPlacement } from './level_spawn_rules';

export type { BubbleCoralEnvironmentConfig };
export type { BubbleCoralPlacement };
export {
    shouldSpawnBubbleCoral,
    getBubbleCoralPlacement,
    resolveBubbleCoralClusterCount
} from './level_spawn_rules';

const MAX_CLUSTERS = 12;
const BUBBLES_PER_CLUSTER = 10;
const INNER_BUBBLES = 12;
const MAX_TOTAL_CLUSTERS = 14;

const RAINBOW_STOPS = [
    new THREE.Color(0xff6b9d),
    new THREE.Color(0xffb347),
    new THREE.Color(0xfff56d),
    new THREE.Color(0x90ee90),
    new THREE.Color(0x66ccff),
    new THREE.Color(0xda70d6)
];

const BUBBLE_GEOMETRY = new THREE.SphereGeometry(0.35, 6, 5);
const HERO_GEOMETRY = new THREE.SphereGeometry(0.55, 7, 6, 0, Math.PI * 2, 0, Math.PI * 0.62);
const WHIP_GEOMETRY = new THREE.PlaneGeometry(0.12, 2.8, 1, 4);

function createBubbleCoralMaterial(): MeshBasicNodeMaterial {
    const mat = new MeshBasicNodeMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.NormalBlending
    });

    const aHue = attribute('aHue', 'float');
    const aPhase = attribute('aPhase', 'float');
    const uTime = time;

    const wobble = sin(uTime.mul(1.8).add(aPhase)).mul(0.04);
    mat.positionNode = positionLocal.add(vec3(wobble, wobble.mul(0.6), float(0)));

    const nView = normalView;
    const rim = float(1.0).sub(nView.z.abs());
    const rimGlow = rim.pow(2.8);

    const hueT = aHue;
    const c1 = vec3(1.0, 0.42, 0.62);
    const c2 = vec3(1.0, 0.7, 0.28);
    const c3 = vec3(1.0, 0.96, 0.43);
    const c4 = vec3(0.56, 0.93, 0.56);
    const c5 = vec3(0.4, 0.8, 1.0);
    const c6 = vec3(0.85, 0.44, 0.84);

    let gradient = mix(c1, c2, smoothstep(float(0.0), float(0.2), hueT));
    gradient = mix(gradient, c3, smoothstep(float(0.2), float(0.4), hueT));
    gradient = mix(gradient, c4, smoothstep(float(0.4), float(0.6), hueT));
    gradient = mix(gradient, c5, smoothstep(float(0.6), float(0.8), hueT));
    gradient = mix(gradient, c6, smoothstep(float(0.8), float(1.0), hueT));

    const innerPulse = sin(
        uTime.mul(2.2).add(aPhase).add(positionLocal.y.mul(3.5))
    ).mul(0.5).add(0.5);
    const highlight = gradient.mul(vec3(1.25, 1.2, 1.3)).mul(innerPulse.mul(0.35).add(0.65));
    const bodyColor = mix(gradient, highlight, rimGlow.mul(0.55));

    mat.colorNode = vec4(bodyColor, float(0.55).add(rimGlow.mul(0.35)));
    mat.opacityNode = float(0.5).add(rimGlow.mul(0.3));

    return mat;
}

function createHeroCoralMaterial(hue: number): THREE.MeshPhysicalMaterial {
    const c = new THREE.Color().setHSL(hue, 0.75, 0.62);
    return new THREE.MeshPhysicalMaterial({
        color: c,
        emissive: c,
        emissiveIntensity: 0.35,
        roughness: 0.15,
        metalness: 0.05,
        transmission: 0.28,
        thickness: 0.6,
        ior: 1.33,
        transparent: true,
        opacity: 0.72,
        side: THREE.DoubleSide
    });
}

function createWhipMaterial(hue: number): THREE.MeshStandardMaterial {
    const c = new THREE.Color().setHSL(hue, 0.6, 0.55);
    return new THREE.MeshStandardMaterial({
        color: c,
        emissive: c,
        emissiveIntensity: 0.25,
        roughness: 0.5,
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide
    });
}

interface InnerBubbleState {
    y: number;
    speed: number;
    phase: number;
    scale: number;
    x: number;
    z: number;
}

interface CoralClusterState {
    group: THREE.Group;
    anchorX: number;
    bubbleMesh: THREE.InstancedMesh;
    innerMesh: THREE.InstancedMesh;
    innerStates: InnerBubbleState[];
    whips: THREE.Mesh[];
    heroes: THREE.Mesh[];
    bubbleCount: number;
    hasWhips: boolean;
    placement: BubbleCoralPlacement;
    phase: number;
    popCooldown: number;
}

/**
 * One coral cluster: hero domes + instanced bubble stack + optional sea whips.
 * Internal rising bubbles use a second InstancedMesh (one draw call each).
 */
class RainbowBubbleCoralCluster {
    readonly state: CoralClusterState;
    private readonly dummy = new THREE.Object3D();
    private readonly scene: THREE.Scene;
    private elapsed = 0;

    constructor(
        scene: THREE.Scene,
        anchorX: number,
        y: number,
        z: number,
        placement: BubbleCoralPlacement,
        hasWhips: boolean
    ) {
        this.scene = scene;
        const group = new THREE.Group();
        group.position.set(anchorX, y, z);
        group.userData.baseY = y;

        const baseHue = Math.random();
        const bubbleMat = createBubbleCoralMaterial();
        const bubbleGeo = BUBBLE_GEOMETRY.clone();
        const bubbleMesh = new THREE.InstancedMesh(bubbleGeo, bubbleMat, BUBBLES_PER_CLUSTER);
        bubbleMesh.frustumCulled = false;
        bubbleMesh.renderOrder = 2;

        const hues = new Float32Array(BUBBLES_PER_CLUSTER);
        const phases = new Float32Array(BUBBLES_PER_CLUSTER);
        const scales = new Float32Array(BUBBLES_PER_CLUSTER);

        const heroes: THREE.Mesh[] = [];
        const heroCount = 1 + Math.floor(Math.random() * 2);
        for (let h = 0; h < heroCount; h++) {
            const hero = new THREE.Mesh(
                HERO_GEOMETRY.clone(),
                createHeroCoralMaterial((baseHue + h * 0.15) % 1)
            );
            hero.position.set(
                (Math.random() - 0.5) * 0.6,
                h * 0.45 + 0.2,
                (Math.random() - 0.5) * 0.5
            );
            hero.scale.setScalar(0.9 + Math.random() * 0.5);
            hero.userData.baseScale = hero.scale.x;
            group.add(hero);
            heroes.push(hero);
        }

        for (let i = 0; i < BUBBLES_PER_CLUSTER; i++) {
            const layer = Math.floor(i / 3);
            const angle = (i % 3) / 3 * Math.PI * 2 + layer * 0.8;
            const radius = 0.35 + layer * 0.22;
            const bx = Math.cos(angle) * radius;
            const by = layer * 0.38 + 0.15;
            const bz = Math.sin(angle) * radius * 0.7;

            hues[i] = (baseHue + i * 0.08 + layer * 0.05) % 1;
            phases[i] = Math.random() * Math.PI * 2;
            scales[i] = 0.55 + Math.random() * 0.55;

            this.dummy.position.set(bx, by, bz);
            this.dummy.scale.setScalar(scales[i]);
            this.dummy.updateMatrix();
            bubbleMesh.setMatrixAt(i, this.dummy.matrix);
        }

        bubbleGeo.setAttribute('aHue', new THREE.InstancedBufferAttribute(hues, 1));
        bubbleGeo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phases, 1));
        group.add(bubbleMesh);

        const innerMat = createBubbleCoralMaterial();
        const innerGeo = BUBBLE_GEOMETRY.clone();
        const innerMesh = new THREE.InstancedMesh(innerGeo, innerMat, INNER_BUBBLES);
        innerMesh.frustumCulled = false;
        innerMesh.renderOrder = 3;

        const innerHues = new Float32Array(INNER_BUBBLES);
        const innerPhases = new Float32Array(INNER_BUBBLES);
        const innerStates: InnerBubbleState[] = [];

        for (let i = 0; i < INNER_BUBBLES; i++) {
            innerHues[i] = Math.random();
            innerPhases[i] = Math.random() * Math.PI * 2;
            innerStates.push({
                y: Math.random() * 2.2 - 0.5,
                speed: 0.35 + Math.random() * 0.55,
                phase: Math.random() * Math.PI * 2,
                scale: 0.12 + Math.random() * 0.15,
                x: (Math.random() - 0.5) * 0.9,
                z: (Math.random() - 0.5) * 0.6
            });
        }

        innerGeo.setAttribute('aHue', new THREE.InstancedBufferAttribute(innerHues, 1));
        innerGeo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(innerPhases, 1));
        group.add(innerMesh);

        const whips: THREE.Mesh[] = [];
        if (hasWhips) {
            const whipCount = 1 + Math.floor(Math.random() * 2);
            for (let w = 0; w < whipCount; w++) {
                const whip = new THREE.Mesh(
                    WHIP_GEOMETRY.clone(),
                    createWhipMaterial((baseHue + 0.3 + w * 0.1) % 1)
                );
                whip.position.set(
                    (Math.random() - 0.5) * 1.2,
                    -0.5,
                    (Math.random() - 0.5) * 0.8
                );
                whip.rotation.y = Math.random() * Math.PI;
                whip.userData.swayPhase = Math.random() * Math.PI * 2;
                group.add(whip);
                whips.push(whip);
            }
        }

        scene.add(group);

        this.state = {
            group,
            anchorX,
            bubbleMesh,
            innerMesh,
            innerStates,
            whips,
            heroes,
            bubbleCount: BUBBLES_PER_CLUSTER,
            hasWhips,
            placement,
            phase: Math.random() * Math.PI * 2,
            popCooldown: 1 + Math.random() * 2
        };

        this._writeInnerBubbles();
    }

    private _writeInnerBubbles() {
        const s = this.state;
        for (let i = 0; i < INNER_BUBBLES; i++) {
            const st = s.innerStates[i];
            const wobbleX = Math.sin(this.elapsed * 2 + st.phase) * 0.08;
            this.dummy.position.set(st.x + wobbleX, st.y, st.z);
            this.dummy.scale.setScalar(st.scale);
            this.dummy.updateMatrix();
            s.innerMesh.setMatrixAt(i, this.dummy.matrix);
        }
        s.innerMesh.instanceMatrix.needsUpdate = true;
    }

    update(
        delta: number,
        cameraX: number,
        particleSystem?: ParticleSystem
    ): void {
        this.elapsed += delta;
        const s = this.state;
        const margin = 140;
        const visible = s.anchorX > cameraX - margin && s.anchorX < cameraX + margin + 60;
        s.group.visible = visible;
        if (!visible) return;

        const bob = Math.sin(this.elapsed * 0.6 + s.phase) * 0.25;
        const baseY = s.group.userData.baseY as number;
        s.group.position.y = baseY + bob;

        for (const hero of s.heroes) {
            const base = hero.userData.baseScale as number;
            const pulse = 1 + Math.sin(this.elapsed * 1.4 + s.phase) * 0.06;
            hero.scale.setScalar(base * pulse);
        }

        for (const whip of s.whips) {
            const phase = whip.userData.swayPhase as number;
            whip.rotation.z = Math.sin(this.elapsed * 1.1 + phase) * 0.35;
            whip.rotation.x = Math.cos(this.elapsed * 0.9 + phase) * 0.12;
        }

        s.popCooldown -= delta;
        for (let i = 0; i < INNER_BUBBLES; i++) {
            const st = s.innerStates[i];
            st.y += st.speed * delta;
            if (st.y > 2.4) {
                if (s.popCooldown <= 0 && particleSystem) {
                    const popPos = s.group.position.clone();
                    popPos.y += st.y;
                    const color = RAINBOW_STOPS[Math.floor(Math.random() * RAINBOW_STOPS.length)];
                    particleSystem.emit(popPos, color.getHex(), 4, 1.2, 0.35, 0.2);
                    s.popCooldown = 0.4 + Math.random() * 0.8;
                }
                st.y = -0.4 - Math.random() * 0.3;
                st.speed = 0.35 + Math.random() * 0.55;
            }
        }

        this._writeInnerBubbles();
    }

    dispose() {
        this.scene.remove(this.state.group);
        this.state.bubbleMesh.geometry.dispose();
        this.state.innerMesh.geometry.dispose();
        if ((this.state.bubbleMesh.material as THREE.Material).dispose) {
            (this.state.bubbleMesh.material as THREE.Material).dispose();
        }
        if ((this.state.innerMesh.material as THREE.Material).dispose) {
            (this.state.innerMesh.material as THREE.Material).dispose();
        }
        for (const h of this.state.heroes) {
            h.geometry.dispose();
            (h.material as THREE.Material).dispose();
        }
        for (const w of this.state.whips) {
            w.geometry.dispose();
            (w.material as THREE.Material).dispose();
        }
    }

    get anchorX() {
        return this.state.anchorX;
    }
}

/**
 * Rainbow bubble coral clusters for waterfall walls, aquatic tunnels, and biological reefs.
 *
 * PERFORMANCE: Bubble domes are InstancedMesh (one draw call per cluster).
 * Total clusters capped to stay within foliage + geological active budgets.
 */
export class RainbowBubbleCoralManager {
    private readonly scene: THREE.Scene;
    private readonly particleSystem?: ParticleSystem;
    private clusters: RainbowBubbleCoralCluster[] = [];
    active = false;

    constructor(scene: THREE.Scene, particleSystem?: ParticleSystem) {
        this.scene = scene;
        this.particleSystem = particleSystem;
    }

    activate() {
        this.active = true;
    }

    deactivate() {
        this.active = false;
        this.clear();
    }

    spawnForLevel(
        startX: number,
        length: number,
        clusterCount: number,
        placement: BubbleCoralPlacement
    ) {
        this.clear();

        const count = Math.min(
            MAX_TOTAL_CLUSTERS,
            Math.max(1, Math.floor(clusterCount))
        );

        const zRange: [number, number] = [DEPTH_LAYERS.BACKGROUND.min, DEPTH_LAYERS.MIDGROUND.max];

        for (let i = 0; i < count; i++) {
            const t = (i + 0.5) / count;
            const anchorX = startX + t * length + (Math.random() - 0.5) * (length / count) * 0.35;

            let y: number;
            let z: number;
            switch (placement) {
                case 'wall':
                    y = -6 - Math.random() * 10;
                    z = -12 + Math.random() * 8;
                    break;
                case 'tunnel':
                    y = (Math.random() < 0.5 ? -1 : 1) * (5 + Math.random() * 4);
                    z = -8 + Math.random() * 6;
                    break;
                case 'reef':
                default:
                    y = (Math.random() - 0.5) * 16;
                    z = randomZInRange(zRange);
                    break;
            }

            const hasWhips = placement !== 'tunnel' && Math.random() < 0.45;
            this.clusters.push(
                new RainbowBubbleCoralCluster(this.scene, anchorX, y, z, placement, hasWhips)
            );
        }
    }

    update(delta: number, cameraX: number) {
        if (!this.active) return;
        for (const cluster of this.clusters) {
            cluster.update(delta, cameraX, this.particleSystem);
        }
    }

    cleanupFarBehind(cameraX: number) {
        const cutoff = cameraX - 170;
        const remaining: RainbowBubbleCoralCluster[] = [];
        for (const cluster of this.clusters) {
            if (cluster.anchorX < cutoff) {
                cluster.dispose();
            } else {
                remaining.push(cluster);
            }
        }
        this.clusters = remaining;
    }

    clear() {
        for (const cluster of this.clusters) {
            cluster.dispose();
        }
        this.clusters = [];
    }
}
