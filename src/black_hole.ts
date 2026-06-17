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

/**
 * Creates a TSL material for the accretion disk.
 */
function createAccretionDiskMaterial() {
    const mat = new MeshBasicNodeMaterial({
        transparent: true,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false
    });

    const vUv = uv();
    // Center UVs to -0.5 to 0.5
    const centeredUv = vUv.sub(0.5);
    const dist = length(centeredUv).mul(2.0); // 0 at center, 1 at edge

    // Basic rotation over time
    const uTime = time;
    const speed = 0.5;
    const angle = uTime.mul(speed);

    const c = cos(angle);
    const s = sin(angle);
    const rotX = centeredUv.x.mul(c).sub(centeredUv.y.mul(s));
    const rotY = centeredUv.x.mul(s).add(centeredUv.y.mul(c));
    const rotatedUv = vec2(rotX, rotY);

    // Procedural Noise approximation for billowing fire
    // Create multiple frequency rings
    const ring1 = sin(dist.mul(20.0).sub(uTime.mul(3.0)));
    const ring2 = sin(dist.mul(50.0).add(uTime.mul(5.0)));

    // Angular noise based on rotated UVs
    const angleVal = rotatedUv.y.atan2(rotatedUv.x);
    const angNoise = sin(angleVal.mul(10.0).add(dist.mul(10.0)).sub(uTime.mul(2.0)));
    const angNoise2 = cos(angleVal.mul(20.0).sub(dist.mul(5.0)).add(uTime.mul(4.0)));

    const noise = ring1.add(ring2).add(angNoise).add(angNoise2).mul(0.25).add(0.5);

    // Fade out inner and outer edges
    const innerFade = smoothstep(0.3, 0.4, dist);
    const outerFade = float(1.0).sub(smoothstep(0.8, 1.0, dist));
    const diskMask = innerFade.mul(outerFade);

    // Colors: Fiery Orange to Purple/Dark Red
    const coreColor = color(0xffffff); // White hot center
    const midColor = color(0xff6600); // Orange
    const edgeColor = color(0x660033); // Dark purple/red edge

    // Color gradient based on distance from center
    const colorMix1 = mix(coreColor, midColor, smoothstep(0.3, 0.6, dist));
    const colorMix2 = mix(colorMix1, edgeColor, smoothstep(0.6, 0.9, dist));

    // Combine color with noise and mask
    const finalAlpha = noise.mul(diskMask).pow(1.5);
    const finalColor = colorMix2.mul(float(1.5).add(noise)); // Boost brightness where noise is high

    mat.colorNode = vec4(finalColor, finalAlpha);

    return mat;
}

/**
 * Creates a TSL material for the gravitational lensing halo (event horizon edge).
 */
function createHaloMaterial() {
    const mat = new MeshBasicNodeMaterial({
        transparent: true,
        blending: THREE.AdditiveBlending,
        side: THREE.FrontSide,
        depthWrite: false
    });

    const vUv = uv();
    const centeredUv = vUv.sub(0.5);
    const dist = length(centeredUv).mul(2.0);

    // Very sharp thin ring
    const innerFade = smoothstep(0.85, 0.9, dist);
    const outerFade = float(1.0).sub(smoothstep(0.9, 1.0, dist));
    const mask = innerFade.mul(outerFade);

    mat.colorNode = vec4(color(0xffaa55), mask.mul(0.8));

    return mat;
}

export class BlackHoleSystem {
    scene: THREE.Scene;
    active: boolean = false;

    group: THREE.Group;
    eventHorizon: THREE.Mesh;
    accretionDisk: THREE.Mesh;
    halo: THREE.Mesh;

    baseX: number = 2000; // Far ahead in the level
    baseZ: number = -400; // Deep background
    baseY: number = 100;

    parallaxFactor: number = 0.05;

    constructor(scene: THREE.Scene) {
        this.scene = scene;
        this.group = new THREE.Group();

        // 1. Event Horizon (The dark void)
        const ehGeo = new THREE.SphereGeometry(30, 32, 32);
        const ehMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
        this.eventHorizon = new THREE.Mesh(ehGeo, ehMat);

        // 2. Accretion Disk
        // We use a plane so we can do UV-based procedural noise easily
        const adGeo = new THREE.PlaneGeometry(240, 240);
        const adMat = createAccretionDiskMaterial();
        this.accretionDisk = new THREE.Mesh(adGeo, adMat);
        // Tilt the disk
        this.accretionDisk.rotation.x = -Math.PI * 0.4;
        this.accretionDisk.rotation.y = Math.PI * 0.1;
        this.accretionDisk.position.z = -1; // Slightly behind the sphere center

        // 3. Gravitational Lensing Halo (glow around the event horizon)
        const haloGeo = new THREE.PlaneGeometry(70, 70);
        const haloMat = createHaloMaterial();
        this.halo = new THREE.Mesh(haloGeo, haloMat);
        this.halo.position.z = 1; // Slightly in front

        this.group.add(this.accretionDisk);
        this.group.add(this.eventHorizon);
        this.group.add(this.halo);

        // Render deep in background
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
    }

    update(delta: number, cameraX: number) {
        if (!this.active) return;

        // Slow parallax to emphasize massive scale and distance
        const relativeX = cameraX * this.parallaxFactor;

        // As the player moves forward, the black hole slowly approaches and drifts slightly down
        this.group.position.set(
            this.baseX + relativeX,
            this.baseY - (cameraX * 0.01),
            this.baseZ
        );

        // Optional: Slowly bob or tilt the disk over long time periods
        const timeSec = performance.now() * 0.001;
        this.accretionDisk.rotation.y = Math.PI * 0.1 + Math.sin(timeSec * 0.2) * 0.05;
        this.accretionDisk.rotation.x = -Math.PI * 0.4 + Math.cos(timeSec * 0.15) * 0.05;
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
