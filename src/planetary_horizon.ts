import * as THREE from 'three';
import {
    MeshStandardNodeMaterial,
    MeshBasicNodeMaterial,
    PointsNodeMaterial
} from 'three/webgpu';
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
    smoothstep,
    dot,
    normalView,
    normalWorld,
    positionLocal,
    cameraPosition
, length } from 'three/tsl';

// --- Global Config ---
// Light coming from top-left-front: (-1, 0.5, 1) normalized
const SUN_DIR = vec3(-0.8, 0.4, 0.8).normalize();

// --- TSL Noise Helpers ---

// Simple pseudo-random function
// Returns float 0..1
const random2D = (v: any) => {
    return sin(dot(v, vec2(12.9898, 78.233))).mul(43758.5453).fract();
};

// Value Noise 2D
// We can use a simplified version using sin waves for stability if explicit noise is hard
const valueNoise = (v: any) => {
    const i = v.floor();
    const f = v.fract();

    // Four corners
    const a = random2D(i);
    const b = random2D(i.add(vec2(1.0, 0.0)));
    const c = random2D(i.add(vec2(0.0, 1.0)));
    const d = random2D(i.add(vec2(1.0, 1.0)));

    const u = f.mul(f).mul(float(3.0).sub(f.mul(2.0))); // smoothstep curve

    return mix(a, b, u.x).add(
        (c.sub(a).mul(u.y).mul(float(1.0).sub(u.x))).add(
        (d.sub(b).mul(u.x).mul(u.y)))
    );
};

// Fractal Brownian Motion (3 Octaves)
const fbm = (v: any) => {
    let total: any = float(0.0);
    let amplitude: any = float(0.5);
    let frequency: any = float(1.0);

    // Octave 1
    total = total.add(valueNoise(v.mul(frequency)).mul(amplitude));

    // Octave 2
    frequency = frequency.mul(2.0);
    amplitude = amplitude.mul(0.5);
    total = total.add(valueNoise(v.mul(frequency)).mul(amplitude));

    // Octave 3
    frequency = frequency.mul(2.0);
    amplitude = amplitude.mul(0.5);
    total = total.add(valueNoise(v.mul(frequency)).mul(amplitude));

    return total;
};

/**
 * Creates a TSL material for the Planet Surface (High Detail).
 * Features: Day/Night Cycle, City Lights, Specular Oceans
 */
function createPlanetSurfaceMaterial(baseColorHex: number) {
    const mat = new MeshStandardNodeMaterial({
        color: baseColorHex,
        roughness: 0.7,
        metalness: 0.2,
    });

    const uTime = time;
    const uScrollSpeed = uniform(0.015); // Slow rotation

    const vUv = uv();

    // Scroll texture horizontally to simulate planet rotation under the ship
    const scrollX = uTime.mul(uScrollSpeed);
    const p = vec2(vUv.x.add(scrollX).mul(10.0), vUv.y.mul(10.0)); // Scale UVs

    // Generate Height/Terrain Map
    const height = fbm(p); // 0..1

    // Generate City Noise (High Frequency)
    const cityNoise = fbm(p.mul(4.0)); // Finer detail for cities

    // Terrain Classification
    // Ocean < 0.45
    // Land 0.45 - 0.7
    // Mountain > 0.7

    const oceanColor = color(0x051040); // Deep Blue/Black
    const coastColor = color(0x1a4080); // Lighter Blue
    const landColor = color(0x2a2a35);  // Alien Grey/Rock
    const mountainColor = color(0x555566); // Snowy/Rocky peaks
    const cityLightColor = color(0xffaa44); // Sodium vapor orange

    // Mix Colors (Daytime Albedo)
    // 1. Ocean vs Land
    const isLand = smoothstep(0.4, 0.45, height);
    let albedo = mix(oceanColor, landColor, isLand);

    // 2. Coastline highlight (rim of land)
    const isCoast = smoothstep(0.4, 0.45, height).sub(smoothstep(0.45, 0.5, height));
    albedo = mix(albedo, coastColor, isCoast.mul(0.5));

    // 3. Mountains
    const isMountain = smoothstep(0.7, 0.8, height);
    albedo = mix(albedo, mountainColor, isMountain);

    // --- LIGHTING LOGIC ---

    // Day/Night Mask based on World Normal and Sun Direction
    // Use normalWorld to get the actual lighting orientation relative to the "sun"
    const NdotL = dot(normalWorld, SUN_DIR);
    const dayFactor = smoothstep(-0.2, 0.2, NdotL); // Soft terminator
    const nightFactor = float(1.0).sub(dayFactor);

    // City Lights Logic
    // Cities appear on Land, not Mountains (too high), not Ocean
    // And primarily where cityNoise is high (clusters)
    const isCityLocation = isLand.mul(float(1.0).sub(isMountain));
    const cityPattern = smoothstep(0.6, 0.8, cityNoise); // Only peaks
    const cityLights = cityPattern.mul(isCityLocation).mul(cityLightColor).mul(3.0); // Intense emission

    // Only show city lights at night
    const visibleCityLights = cityLights.mul(nightFactor);

    // Specular / Roughness Map
    // Oceans are smooth (low roughness), Land is rough
    const rough = mix(float(0.2), float(0.9), isLand);
    mat.roughnessNode = rough;

    // Output
    // We add the city lights to the emissive channel
    mat.colorNode = vec4(albedo, 1.0);
    mat.emissiveNode = visibleCityLights;

    return mat;
}

/**
 * Creates a TSL material for the Cloud Layer.
 */
function createPlanetCloudMaterial() {
    const mat = new MeshStandardNodeMaterial({
        transparent: true,
        opacity: 0.8,
        roughness: 1.0,
        metalness: 0.0,
        side: THREE.FrontSide
    });

    const uTime = time;
    const uCloudSpeed = uniform(0.025); // Slightly faster than surface

    const vUv = uv();
    const scrollX = uTime.mul(uCloudSpeed);
    const p = vec2(vUv.x.add(scrollX).mul(8.0), vUv.y.mul(8.0));

    // Cloud Noise
    const n = fbm(p.add(vec2(23.4, 51.2))); // Offset seed

    // Threshold for clouds (only show high density)
    const density = smoothstep(0.5, 0.8, n);

    const cloudColor = color(0xaaccff);

    // Lighting for clouds
    // We don't need explicit lighting calculation here as standard material handles it,
    // but we could modulate opacity at night if desired. keeping simple.

    // Shadows? Simple approximation: darken bottom of clouds?
    // For now just white/blue clouds
    mat.colorNode = vec4(cloudColor, density.mul(0.8)); // Max opacity 0.8

    return mat;
}

/**
 * Creates a TSL material for the Atmosphere Halo.
 * Enhanced for volumetric feel.
 */
function createAtmosphereMaterial(atmosphereColorHex: number) {
    const mat = new MeshBasicNodeMaterial({
        transparent: true,
        side: THREE.BackSide, // Render on the inside of a slightly larger sphere? Or BackSide of outer shell?
        // Usually atmosphere is a shell larger than planet. BackSide allows seeing it "behind" the planet edge if we are outside?
        // Actually FrontSide is fine if we use additive blending and Fresnel.
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });

    // We want the atmosphere to be visible on the limb (Fresnel)
    // And also stronger on the day side (Sun direction)

    const nView = normalView;

    // Fresnel / Rim
    // 0 at center, 1 at edge
    const rim = float(1.0).sub(nView.z.abs());
    const glow = rim.pow(4.0); // Sharper rim

    // Day side mask
    // We need normalWorld for sun direction
    const NdotL = dot(normalWorld, SUN_DIR);
    const dayFactor = smoothstep(-0.5, 0.5, NdotL); // Atmosphere wraps around slightly into night

    // Color
    const atmColor = color(atmosphereColorHex);
    const sunsetColor = color(0xff4400); // Orange tint at terminator?

    // Mix sunset color near terminator (where NdotL is near 0)
    const isTerminator = float(1.0).sub(NdotL.abs().mul(2.0).clamp(0.0, 1.0));
    const finalColor = mix(atmColor, sunsetColor, isTerminator.mul(0.5));

    // Final Intensity
    // Glow * (DayFactor + ambient)
    const intensity = glow.mul(dayFactor.add(0.1));

    mat.colorNode = vec4(finalColor, intensity.mul(0.8));

    return mat;
}

/**
 * Creates Deep Space Starfield points that will parallax.
 */
function createDeepSpaceStars(count: number = 1000) {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);

    const width = 1000;
    const height = 500;
    const depth = 200;

    for(let i=0; i<count; i++) {
        positions[i*3] = (Math.random() - 0.5) * width;
        positions[i*3+1] = (Math.random() - 0.5) * height; // Above and below horizon
        positions[i*3+2] = (Math.random() - 0.5) * depth - 100; // Far behind planet

        sizes[i] = Math.random() * 2.0 + 0.5;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const mat = new PointsNodeMaterial({
        size: 1.0,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    // Simple white stars
    mat.colorNode = vec4(1.0, 1.0, 1.0, 1.0);

    const stars = new THREE.Points(geo, mat);
    stars.frustumCulled = false; // Always render, we handle wrapping manually
    return stars;
}



/**
 * Creates a TSL material for Planetary Rings.
 */
function createPlanetaryRingMaterial(ringColorHex: number) {
    const mat = new MeshStandardNodeMaterial({
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        roughness: 0.4,
        metalness: 0.1
    });

    const pos = positionLocal;
    // RingGeometry is in XY plane, so radius is length of xy
    const radius = length(pos.xy);

    // Procedural banding using fbm
    const bandNoise = fbm(vec2(radius.mul(0.05), float(0.0)));
    const bandNoise2 = fbm(vec2(radius.mul(0.1), float(100.0)));

    // Combine noises for dense and sparse bands
    let density: any = smoothstep(0.3, 0.7, bandNoise).add(smoothstep(0.5, 0.8, bandNoise2).mul(0.5));
    density = density.clamp(0.0, 1.0);

    // Fade edges (inner and outer)
    // Assuming inner radius ~ 500, outer radius ~ 800
    const innerFade = smoothstep(500.0, 520.0, radius);
    const outerFade = smoothstep(780.0, 800.0, radius).oneMinus();
    density = density.mul(innerFade).mul(outerFade);

    // Color
    const baseColor = color(ringColorHex);
    // Add some variation
    const finalColor = mix(baseColor, color(0xffffff), bandNoise2.mul(0.3));

    mat.colorNode = vec4(finalColor, density.mul(0.6));

    // Optional: add a bit of emissive so they glow in the dark
    mat.emissiveNode = finalColor.mul(density).mul(0.2);

    return mat;
}

export class AtmosphereOverlay {
    mesh: THREE.Mesh;
    uIntensity: any;

    constructor(camera: THREE.Camera) {
        const geo = new THREE.PlaneGeometry(2, 2);

        this.uIntensity = uniform(0.0);

        const mat = new MeshBasicNodeMaterial({
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide
        });

        const atmColor = color(0x114488); // Atmospheric blue
        mat.colorNode = vec4(atmColor, this.uIntensity);

        this.mesh = new THREE.Mesh(geo, mat);
        this.mesh.position.set(0, 0, -1.05); // Just in front of camera
        this.mesh.visible = false;

        camera.add(this.mesh);
    }

    setIntensity(intensity: number) {
        this.uIntensity.value = intensity;
        this.mesh.visible = intensity > 0.01;
    }
}

export class PlanetaryHorizonSystem {
    scene: THREE.Scene;
    active: boolean = false;

    // Components
    container: THREE.Group;
    planet: THREE.Mesh;
    clouds: THREE.Mesh;
    atmosphere: THREE.Mesh;
    rings: THREE.Mesh;
    bgStars: THREE.Points;

    // Level Config
    levelDistance: number = 2200;

    // Parallax Config
    // Planet moves with camera X (Horizon)
    // BgStars move at 95% camera speed (creating "Deep Space" depth where they drift slowly)
    starPositions: Float32Array;


    atmosphereOverlay: AtmosphereOverlay;

    // "Path to the Moon" finale gate - a glowing crystal arch that opens
    // once the Level 6 capstone objective is complete.
    moonGate: THREE.Group;
    moonGateRing: THREE.Mesh;
    moonGateCore: THREE.Mesh;
    moonGateLight: THREE.PointLight;
    moonGateActive: boolean = false;
    moonGateOpenTime: number = 0;

    constructor(scene: THREE.Scene, camera: THREE.Camera) {
        this.scene = scene;
        this.container = new THREE.Group();
        this.scene.add(this.container);

        const radius = 400;

        // 1. Planet Surface
        const planetGeo = new THREE.SphereGeometry(radius, 128, 128); // Higher detail
        const planetMat = createPlanetSurfaceMaterial(0x2255ff);
        this.planet = new THREE.Mesh(planetGeo, planetMat);
        // Adjusted Y to -405 so the horizon (top at -5) is visible at the bottom of the screen
        this.planet.position.set(0, -405, -100);
        this.container.add(this.planet);

        // 2. Cloud Layer
        const cloudGeo = new THREE.SphereGeometry(radius * 1.01, 128, 128); // Slightly larger
        const cloudMat = createPlanetCloudMaterial();
        this.clouds = new THREE.Mesh(cloudGeo, cloudMat);
        this.clouds.position.copy(this.planet.position);
        this.container.add(this.clouds);

        // 3. Atmosphere Halo
        // Should be slightly larger and maybe FrontSide
        const atmGeo = new THREE.SphereGeometry(radius * 1.15, 64, 64);
        const atmMat = createAtmosphereMaterial(0x4488ff);
        this.atmosphere = new THREE.Mesh(atmGeo, atmMat);
        this.atmosphere.position.copy(this.planet.position);
        this.container.add(this.atmosphere);


        // 3.5 Planetary Rings
        const ringGeo = new THREE.RingGeometry(500, 800, 128);
        const ringMat = createPlanetaryRingMaterial(0x88ccff);
        this.rings = new THREE.Mesh(ringGeo, ringMat);
        this.rings.position.copy(this.planet.position);
        // Tilt the rings
        this.rings.rotation.x = Math.PI / 2 - 0.2; // Tilted slightly towards camera
        this.rings.rotation.y = 0.1;
        this.container.add(this.rings);

        // 4. Deep Space Stars
        this.bgStars = createDeepSpaceStars(2000);
        this.bgStars.position.z = -200; // Far back
        this.starPositions = (this.bgStars.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array;
        this.container.add(this.bgStars);

        // 5. Atmosphere Overlay for gradual palette shift
        this.atmosphereOverlay = new AtmosphereOverlay(camera);

        // 6. "Path to the Moon" gate - hidden crystal arch, added directly to
        // the scene so it can be revealed independently of activate/deactivate.
        this.moonGate = new THREE.Group();
        const ringGeo2 = new THREE.TorusGeometry(14, 1.4, 24, 64);
        const ringMat2 = new THREE.MeshStandardMaterial({
            color: 0xbbeeff,
            emissive: 0x88ddff,
            emissiveIntensity: 1.5,
            roughness: 0.2,
            metalness: 0.6
        });
        this.moonGateRing = new THREE.Mesh(ringGeo2, ringMat2);
        this.moonGate.add(this.moonGateRing);

        const coreGeo = new THREE.CircleGeometry(12.5, 48);
        const coreMat = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.0,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide
        });
        this.moonGateCore = new THREE.Mesh(coreGeo, coreMat);
        this.moonGate.add(this.moonGateCore);

        this.moonGateLight = new THREE.PointLight(0xaaeeff, 0, 120);
        this.moonGate.add(this.moonGateLight);

        this.moonGate.visible = false;
        this.moonGate.scale.setScalar(0.01);
        this.scene.add(this.moonGate);

        this.deactivate();
    }

    /**
     * Reveal the "Path to the Moon" gate ahead of the player, with a gentle
     * scale-up + glow animation. Independent of activate()/deactivate() so it
     * can appear even on levels that don't use the planet horizon.
     */
    activateMoonGate(position: THREE.Vector3) {
        this.moonGate.position.copy(position);
        this.moonGate.visible = true;
        this.moonGate.scale.setScalar(0.01);
        this.moonGateActive = true;
        this.moonGateOpenTime = 0;
    }

    /** Animates the moon gate's open/idle state. Call every frame regardless of activate state. */
    updateMoonGate(delta: number) {
        if (!this.moonGateActive) return;
        this.moonGateOpenTime += delta;

        // Scale-up "bloom" over the first 2.5s
        const openProgress = Math.min(1, this.moonGateOpenTime / 2.5);
        const eased = 1 - Math.pow(1 - openProgress, 3);
        this.moonGate.scale.setScalar(0.01 + eased * 0.99);

        // Gentle rotation + pulsing glow once open
        this.moonGateRing.rotation.z += delta * 0.15;
        const pulse = Math.sin(this.moonGateOpenTime * 1.5) * 0.3 + 0.7;
        (this.moonGateRing.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.2 + pulse * 0.8;

        const coreMat = this.moonGateCore.material as THREE.MeshBasicMaterial;
        coreMat.opacity = eased * (0.35 + pulse * 0.15);

        this.moonGateLight.intensity = eased * (3 + pulse * 2);
    }
    activate() {
        if (this.active) return;
        this.active = true;
        this.container.visible = true;
        if (this.atmosphereOverlay) this.atmosphereOverlay.mesh.visible = true;
    }

    deactivate() {
        if (!this.active) return;
        this.active = false;
        this.container.visible = false;
        if (this.atmosphereOverlay) this.atmosphereOverlay.mesh.visible = false;
    }

    update(cameraX: number, delta: number = 0.016) {
        if (!this.active) return;

        // 1. Planet Follows Camera Exactly (Horizon Effect)
        // This makes the planet feel massive and stationary relative to the "horizon" line
        this.planet.position.x = cameraX;
        this.clouds.position.x = cameraX;

        this.atmosphere.position.x = cameraX;
        this.rings.position.x = cameraX;


        // 2. Stars Parallax
        // Stars should move SLOWER than camera to appear far away.
        // If they move at 0.95 * cameraX, they drift backwards at 0.05 speed relative to camera.
        // But we need to wrap them so we never run out of stars.

        const parallaxFactor = 0.95;
        const starContainerX = cameraX * parallaxFactor;

        // We simulate the container moving, but since we want infinite wrapping,
        // we might keep container at 0 and update star positions?
        // Or keep container at starContainerX and wrap local positions?

        this.bgStars.position.x = starContainerX;

        // Wrapping Logic
        // The view window in "Star Space" is [cameraX - width/2, cameraX + width/2]
        // But since we moved the container to `starContainerX`, the local view window is shifted.
        // Relative Camera X inside the container:
        const relCamX = cameraX - starContainerX; // = cameraX * (1 - 0.95) = 0.05 * cameraX

        // We wrap stars around this relative position
        const width = 1000; // Match generation width
        const halfWidth = width / 2;

        const count = this.starPositions.length / 3;
        let needsUpdate = false;

        for(let i=0; i<count; i++) {
            let x = this.starPositions[i*3];

            // If star falls too far behind relative view center
            if (x < relCamX - halfWidth) {
                x += width;
                this.starPositions[i*3] = x;
                needsUpdate = true;
            }
            // If star is too far ahead (e.g. going left)
            else if (x > relCamX + halfWidth) {
                x -= width;
                this.starPositions[i*3] = x;
                needsUpdate = true;
            }
        }

        if (needsUpdate) {
            this.bgStars.geometry.attributes.position.needsUpdate = true;
        }

        // 3. Rotation (Simulated by Shader mostly, but we can add slow mesh rotation too)
        // Rotating the mesh slightly adds 3D curvature feel at the poles
        this.planet.rotation.z += 0.005 * delta;

        this.clouds.rotation.z += 0.008 * delta; // Differential rotation
        this.rings.rotation.z -= 0.002 * delta; // Rings rotate slowly



        // 4. Approach Scaling
        // Scale the planet as we move along X to simulate approaching it.
        // We use a dynamic distance value based on the level configuration if available, otherwise fallback.
        const levelDistance = this.levelDistance || 2200;
        const distanceToPlanet = Math.max(0, levelDistance - cameraX);
        // Map distance levelDistance -> 0 to scale 1.0 -> 1.5
        let approachScale = 1.0 + Math.max(0, (levelDistance - distanceToPlanet) / levelDistance) * 0.5;
        this.planet.scale.setScalar(approachScale);
        this.clouds.scale.setScalar(approachScale);

        this.atmosphere.scale.setScalar(approachScale);
        this.rings.scale.setScalar(approachScale);
        // Move the planet up slightly as it gets closer
        const baseY = -405;
        this.planet.position.y = baseY + (approachScale - 1.0) * 50;
        this.clouds.position.y = this.planet.position.y;
        this.atmosphere.position.y = this.planet.position.y;
        this.rings.position.y = this.planet.position.y;


        // 5. Atmospheric Palette Shift
        // Gradually increase intensity of the blue overlay as we approach the planet
        // e.g. start fading in at distance 1000m to 0m, reaching max 0.6 intensity
        const fadeStartDistance = 1000.0;
        let atmIntensity = 0.0;
        if (distanceToPlanet < fadeStartDistance) {
            atmIntensity = (1.0 - (distanceToPlanet / fadeStartDistance)) * 0.5;
        }
        if (this.atmosphereOverlay) {
            this.atmosphereOverlay.setIntensity(atmIntensity);
        }
    }
}
