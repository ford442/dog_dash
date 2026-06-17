import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import {
    time,
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
    fract
} from 'three/tsl';

// Interaction radii (tuned for gentle hazard feel)
const PULL_RADIUS = 420;
const DISK_INTERACT_RADIUS = 95;
const DANGER_RADIUS = 260;
const FLARE_DECAY = 3.2; // units per second back to baseline

/**
 * Creates a TSL material for the accretion disk with optional flare uniform.
 */
function createAccretionDiskMaterial(flareUniform?: THREE.Uniform) {
    const mat = new MeshBasicNodeMaterial({
        transparent: true,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false
    });

    const vUv = uv();
    const centeredUv = vUv.sub(0.5);
    const dist = length(centeredUv).mul(2.0);

    const uTime = time;
    const speed = 0.5;
    const angle = uTime.mul(speed);

    const c = cos(angle);
    const s = sin(angle);
    const rotX = centeredUv.x.mul(c).sub(centeredUv.y.mul(s));
    const rotY = centeredUv.x.mul(s).add(centeredUv.y.mul(c));
    const rotatedUv = vec2(rotX, rotY);

    const ring1 = sin(dist.mul(20.0).sub(uTime.mul(3.0)));
    const ring2 = sin(dist.mul(50.0).add(uTime.mul(5.0)));

    const angleVal = rotatedUv.y.atan2(rotatedUv.x);
    const angNoise = sin(angleVal.mul(10.0).add(dist.mul(10.0)).sub(uTime.mul(2.0)));
    const angNoise2 = cos(angleVal.mul(20.0).sub(dist.mul(5.0)).add(uTime.mul(4.0)));

    const noise = ring1.add(ring2).add(angNoise).add(angNoise2).mul(0.25).add(0.5);

    const innerFade = smoothstep(0.3, 0.4, dist);
    const outerFade = float(1.0).sub(smoothstep(0.8, 1.0, dist));
    const diskMask = innerFade.mul(outerFade);

    const coreColor = color(0xffffff);
    const midColor = color(0xff6600);
    const edgeColor = color(0x660033);

    const colorMix1 = mix(coreColor, midColor, smoothstep(0.3, 0.6, dist));
    const colorMix2 = mix(colorMix1, edgeColor, smoothstep(0.6, 0.9, dist));

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

    const vUv = uv();
    const centeredUv = vUv.sub(0.5);
    const dist = length(centeredUv).mul(2.0);

    const innerFade = smoothstep(0.85, 0.9, dist);
    const outerFade = float(1.0).sub(smoothstep(0.9, 1.0, dist));
    const mask = innerFade.mul(outerFade);

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

        const adGeo = new THREE.PlaneGeometry(240, 240);
        const adMat = createAccretionDiskMaterial(this.flareUniform);
        this.accretionDisk = new THREE.Mesh(adGeo, adMat);
        this.accretionDisk.rotation.x = -Math.PI * 0.4;
        this.accretionDisk.rotation.y = Math.PI * 0.1;
        this.accretionDisk.position.z = -1;

        const haloGeo = new THREE.PlaneGeometry(70, 70);
        const haloMat = createHaloMaterial(this.haloIntensity);
        this.halo = new THREE.Mesh(haloGeo, haloMat);
        this.halo.position.z = 1;

        this.group.add(this.accretionDisk);
        this.group.add(this.eventHorizon);
        this.group.add(this.halo);

        this.group.renderOrder = -10;
        scene.add(this.group);
        this.deactivate();
    }

    activate() {
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
    }
}
