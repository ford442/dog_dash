import * as THREE from 'three';
import { MeshBasicNodeMaterial, MeshPhysicalNodeMaterial } from 'three/webgpu';
import {
    time,
    normalLocal,
    uv,
    vec2,
    vec3,
    vec4,
    color,
    uniform,
    mix,
    sin,
    cos,
    float,
    length,
    smoothstep,
    fract,
    positionLocal
} from 'three/tsl';

// Interaction radii (tuned for gentle hazard feel)
const PULL_RADIUS = 420;
const DISK_INTERACT_RADIUS = 95;
const DANGER_RADIUS = 260;
const FLARE_DECAY = 3.2; // units per second back to baseline

/**
 * Creates a TSL material for the accretion disk with optional flare uniform.
 */

/**
 * Creates a TSL material for gravitational lensing using transmission and normal bending.
 */
function createLensingMaterial() {
    const mat = new MeshPhysicalNodeMaterial({
        color: 0xffffff,
        transmission: 1.0,
        ior: 2.0,
        thickness: 5.0,
        roughness: 0.0,
        metalness: 0.0,
        transparent: true,
        side: THREE.FrontSide,
        depthWrite: false
    });

    const pos = positionLocal;
    // Plane geometry: length of xy varies from center to edge.
    const dist = length(pos.xy);

    // Bend normal based on distance from center (Plane goes from -55 to 55)
    // At center, dist is 0, at edge it is 55.
    const normalizedDist = dist.div(55.0); // 0 at center, 1 at edge

    // Create a bowl-like normal distortion that pulls towards the center
    // normalLocal is (0,0,1) for plane. We bend it by adding a vector pointing towards the center.
    // The inward vector on the plane is -pos.xy normalized.
    const inwardDir = vec3(pos.xy.normalize().negate(), float(0.5)).normalize();

    // We want the strongest pull just outside the event horizon (radius 30)
    // We can use a bump or smoothstep. Let's make it strong near center and fade out.
    const strength = float(1.0).sub(normalizedDist).pow(1.5).mul(0.6); // 0.6 max bending

    mat.normalNode = mix(normalLocal, inwardDir, strength);

    return mat;
}


function createAccretionDiskMaterial(flareUniform?: THREE.Uniform) {
    const mat = new MeshBasicNodeMaterial({
        transparent: true,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false
    });

    const pos = positionLocal.xy;
    const dist = length(pos);

    // Normalize distance between inner (35) and outer (120) radius
    const innerR = 35.0;
    const outerR = 120.0;
    const normalizedDist = dist.sub(innerR).div(outerR - innerR);

    const uTime = time;
    const speed = 0.5;
    const angle = uTime.mul(speed);

    const c = cos(angle);
    const s = sin(angle);
    const rotX = pos.x.mul(c).sub(pos.y.mul(s));
    const rotY = pos.x.mul(s).add(pos.y.mul(c));
    const rotatedPos = vec2(rotX, rotY);

    const ring1 = sin(normalizedDist.mul(20.0).sub(uTime.mul(3.0)));
    const ring2 = sin(normalizedDist.mul(50.0).add(uTime.mul(5.0)));

    const angleVal = rotatedPos.y.atan2(rotatedPos.x);
    const angNoise = sin(angleVal.mul(10.0).add(normalizedDist.mul(10.0)).sub(uTime.mul(2.0)));
    const angNoise2 = cos(angleVal.mul(20.0).sub(normalizedDist.mul(5.0)).add(uTime.mul(4.0)));

    const noise = ring1.add(ring2).add(angNoise).add(angNoise2).mul(0.25).add(0.5);

    const innerFade = smoothstep(0.0, 0.1, normalizedDist);
    const outerFade = float(1.0).sub(smoothstep(0.8, 1.0, normalizedDist));
    const diskMask = innerFade.mul(outerFade);

    const coreColor = color(0xffffff);
    const midColor = color(0xff6600);
    const edgeColor = color(0x660033);

    const colorMix1 = mix(coreColor, midColor, smoothstep(0.0, 0.4, normalizedDist));
    const colorMix2 = mix(colorMix1, edgeColor, smoothstep(0.4, 0.8, normalizedDist));

    // Flare boosts brightness & alpha temporarily when projectiles hit the disk
    const flare = flareUniform ? flareUniform : float(0.0);
    const flareBoost = float(1.0).add(flare.mul(2.2));

    const finalAlpha = noise.mul(diskMask).pow(1.5).mul(flareBoost);
    const finalColor = colorMix2.mul(float(1.5).add(noise).mul(flareBoost));

    mat.colorNode = vec4(finalColor, finalAlpha);

    return mat;
}

/**
 * Creates a TSL material for the gravitational lensing halo with dynamic intensity.
 */
function createHaloMaterial(intensityUniform?: THREE.Uniform) {
    const mat = new MeshBasicNodeMaterial({
        transparent: true,
        blending: THREE.AdditiveBlending,
        side: THREE.FrontSide,
        depthWrite: false
    });

    const pos = positionLocal.xy;
    const dist = length(pos);

    // Halo sits right at the event horizon (radius 30) up to 35
    const normalizedDist = dist.sub(30.0).div(35.0 - 30.0);

    const innerFade = smoothstep(0.0, 0.1, normalizedDist);
    const outerFade = float(1.0).sub(smoothstep(0.1, 1.0, normalizedDist));
    const mask = innerFade.mul(outerFade).mul(float(1.0).sub(normalizedDist));

    const intensity = intensityUniform ? intensityUniform : float(1.0);
    const finalIntensity = mask.mul(0.8).mul(intensity);

    mat.colorNode = vec4(color(0xffaa55), finalIntensity);

    return mat;
}

export class BlackHoleSystem {
    scene: THREE.Scene;
    active: boolean = false;

    group: THREE.Group;
    eventHorizon: THREE.Mesh;
    accretionDisk: THREE.Mesh;
    halo: THREE.Mesh;
    lensingMesh: THREE.Mesh;

    baseX: number = 2000;
    baseZ: number = -400;
    baseY: number = 100;

    parallaxFactor: number = 0.05;

    // Reactivity uniforms (cheap GPU feedback)
    private flareUniform = uniform(0.0);
    private haloIntensity = uniform(1.0);
    private flareTime = 0;

    // Tunable interaction params (gentle by design)
    pullStrength = 0.22;
    pullRadius = PULL_RADIUS;
    diskInteractRadius = DISK_INTERACT_RADIUS;
    dangerRadius = DANGER_RADIUS;

    constructor(scene: THREE.Scene) {
        this.scene = scene;
        this.group = new THREE.Group();

        const ehGeo = new THREE.SphereGeometry(30, 32, 32);
        const ehMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
        this.eventHorizon = new THREE.Mesh(ehGeo, ehMat);

        const adGeo = new THREE.RingGeometry(35, 120, 64);
        const adMat = createAccretionDiskMaterial(this.flareUniform);
        this.accretionDisk = new THREE.Mesh(adGeo, adMat);
        this.accretionDisk.rotation.x = -Math.PI * 0.4;
        this.accretionDisk.rotation.y = Math.PI * 0.1;
        this.accretionDisk.position.z = -1;

        const haloGeo = new THREE.RingGeometry(30, 35, 64);
        const haloMat = createHaloMaterial(this.haloIntensity);
        this.halo = new THREE.Mesh(haloGeo, haloMat);
        this.halo.position.z = 1;


        const lensingGeo = new THREE.PlaneGeometry(110, 110);
        const lensingMat = createLensingMaterial();
        this.lensingMesh = new THREE.Mesh(lensingGeo, lensingMat);
        this.lensingMesh.position.z = 2; // slightly in front

        this.group.add(this.accretionDisk);
        this.group.add(this.eventHorizon);
        this.group.add(this.halo);
        this.group.add(this.lensingMesh);

        this.group.renderOrder = -10;
        scene.add(this.group);
        this.deactivate();
    }

    activate(config?: { baseX?: number; baseY?: number }) {
        if (config?.baseX !== undefined) this.baseX = config.baseX;
        if (config?.baseY !== undefined) this.baseY = config.baseY;
        if (this.active) return;
        this.active = true;
        this.group.visible = true;
    }

    deactivate() {
        if (!this.active) return;
        this.active = false;
        this.group.visible = false;
        this.flareUniform.value = 0;
        this.haloIntensity.value = 1.0;
    }

    /**
     * Trigger a visual flare on the accretion disk (called when projectiles interact).
     */
    triggerDiskFlare(intensity = 1.0) {
        this.flareTime = Math.max(this.flareTime, intensity);
    }

    /**
     * Gentle gravitational nudge toward the black hole's Y when player is in range.
     * Returns a small Y-velocity bias (added by caller to desired velocity).
     */
    getPlayerPullForce(playerPos: THREE.Vector3): number {
        if (!this.active) return 0;
        const bhPos = this.group.position;
        const dx = bhPos.x - playerPos.x;
        const dy = bhPos.y - playerPos.y;
        const dist = Math.hypot(dx, dy);
        if (dist > this.pullRadius || dist < 1) return 0;

        const falloff = 1 - (dist / this.pullRadius);
        // Bias toward black hole Y (very gentle so it doesn't fight direct controls)
        return Math.sign(dy) * this.pullStrength * falloff * 0.6;
    }

    /**
     * Check projectiles against disk plane and emit feedback.
     * Returns number of interactions processed (for rate limiting).
     */
    handleProjectileInteractions(
        projectiles: any[],
        particleSystem: any,
        onDangerShake?: () => void
    ): number {
        if (!this.active) return 0;
        let interactions = 0;
        const bhPos = this.group.position;
        const maxBursts = 3; // cap per frame for perf

        for (const proj of projectiles) {
            if (!proj?.active) continue;
            const p = proj.mesh.position;
            const dx = p.x - bhPos.x;
            const dy = p.y - bhPos.y;
            const dist = Math.hypot(dx, dy);

            if (dist < this.diskInteractRadius) {
                // Hit the disk area — emit particles + flare
                if (particleSystem && interactions < maxBursts) {
                    const dir = Math.atan2(dy, dx);
                    const vx = Math.cos(dir + 1.2) * 2.4;
                    const vy = Math.sin(dir - 0.8) * 2.1;
                    particleSystem.emit(p.clone(), 0xffaa44, 6, 2.8, 0.9, 0.6);
                }
                this.triggerDiskFlare(0.9);
                interactions++;
                if (interactions >= maxBursts) break;
            } else if (dist < this.dangerRadius && onDangerShake) {
                // Edge graze — light danger feedback
                onDangerShake();
            }
        }
        return interactions;
    }

    update(delta: number, cameraX: number, playerPos?: THREE.Vector3) {
        if (!this.active) return;

        const relativeX = cameraX * this.parallaxFactor;
        this.group.position.set(
            this.baseX + relativeX,
            this.baseY - (cameraX * 0.01),
            this.baseZ
        );

        // Gentle disk bob
        const timeSec = performance.now() * 0.001;
        this.accretionDisk.rotation.y = Math.PI * 0.1 + Math.sin(timeSec * 0.2) * 0.05;
        this.accretionDisk.rotation.x = -Math.PI * 0.4 + Math.cos(timeSec * 0.15) * 0.05;

        // Flare decay
        if (this.flareTime > 0) {
            this.flareTime = Math.max(0, this.flareTime - delta * FLARE_DECAY);
            this.flareUniform.value = this.flareTime;
        } else {
            this.flareUniform.value = 0;
        }

        // Proximity danger pulse on halo when player is close
        if (playerPos) {
            const dist = this.group.position.distanceTo(playerPos);
            const danger = Math.max(0, 1 - dist / this.dangerRadius);
            const pulse = 1.0 + Math.sin(timeSec * 3.5) * danger * 0.35;
            this.haloIntensity.value = 1.0 + danger * 0.6 * pulse;
        } else {
            this.haloIntensity.value = 1.0;
        }
    }

    cleanup() {
        this.scene.remove(this.group);
        this.eventHorizon.geometry.dispose();
        (this.eventHorizon.material as any).dispose();
        this.accretionDisk.geometry.dispose();
        (this.accretionDisk.material as any).dispose?.();

        this.halo.geometry.dispose();
        (this.halo.material as any).dispose?.();
        this.lensingMesh.geometry.dispose();
        (this.lensingMesh.material as any).dispose?.();
    }
}
