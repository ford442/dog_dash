import * as THREE from 'three';
import { MeshBasicNodeMaterial, MeshStandardNodeMaterial } from 'three/webgpu';
import { time, positionLocal, positionWorld, uv, vec2, vec3, vec4, color, uniform, mix, sin, cos, float, length, smoothstep, distance, Loop, step, fract } from 'three/tsl';

function shouldUseLiteMaterials(): boolean {
    return typeof window !== 'undefined' && window.usingWebGL === true;
}

function createLiteIndustrialMaterial(
    colorHex: number,
    roughness: number,
    metalness: number,
    uPlayerPos?: unknown,
    extraUserData?: Record<string, unknown>,
    side: THREE.Side = THREE.FrontSide,
): THREE.MeshStandardMaterial {
    const mat = new THREE.MeshStandardMaterial({
        color: colorHex,
        roughness,
        metalness,
        side,
    });
    if (uPlayerPos) {
        mat.userData.uPlayerPos = uPlayerPos;
    }
    if (extraUserData) {
        Object.assign(mat.userData, extraUserData);
    }
    return mat;
}

export function createConveyorMaterial(speed: number, uPlayerPos: any, weaponLights: any) {
    if (shouldUseLiteMaterials()) {
        return createLiteIndustrialMaterial(0x888888, 0.7, 0.6, uPlayerPos);
    }

    const mat = new MeshStandardNodeMaterial({
        color: 0x888888,
        roughness: 0.7,
        metalness: 0.6,
        side: THREE.FrontSide
    });

    // --- Dynamic Lighting (Player Glow & Weapon Lights) ---
    const uInteractionRadius = uniform(30.0);
    const distToPlayer = length(positionWorld.sub(uPlayerPos));
    const playerGlowIntensity = smoothstep(uInteractionRadius, 0.0, distToPlayer);
    const uPlayerGlowColor = uniform(new THREE.Color(0xff8844)); // Orange engine glow

    const weaponGlow = float(0.0).toVar();
    const uWeaponColor = uniform(new THREE.Color(0x00ffff)); // Cyan weapon glow
    Loop({ start: 0, end: 20 }, ({ i }) => {
        const lightData = weaponLights.element(i);
        const lightPos = lightData.xyz;
        const lightIntensity = lightData.w;
        const distToLight = length(positionWorld.sub(lightPos));
        const wGlow = smoothstep(50.0, 0.0, distToLight).mul(lightIntensity);
        weaponGlow.addAssign(wGlow);
    });

    const dynamicLighting = uPlayerGlowColor.mul(playerGlowIntensity.mul(0.5)).add(uWeaponColor.mul(weaponGlow.mul(0.8)));

    // Pass uniforms to userData so they can be updated
    mat.userData.uPlayerPos = uPlayerPos;


    const uTime = time;
    const uSpeed = uniform(speed);

    // UVs for texture generation
    const vUv = uv();

    // animate UVs: x + time * speed
    // We want diagonal stripes.
    // stripe pattern = fract((u + v) * density - time * speed) -> Inverted direction
    const density = float(10.0);
    // Invert speed direction for "opposite momentum"
    const patternInput = vUv.x.add(vUv.y).mul(density).sub(uTime.mul(uSpeed));
    const stripe = step(0.5, fract(patternInput)); // 0 or 1

    // Colors
    const colorBase = color(0x222222); // Dark rubber/metal
    const colorStripe = color(0xffcc00); // Warning yellow

    // Emission (faint glow on yellow stripes)
    const emissiveBase = color(0x000000);
    const emissiveStripe = color(0x332200);

    mat.colorNode = vec4(mix(colorBase, colorStripe, stripe), 1.0);
    mat.emissiveNode = mix(emissiveBase, emissiveStripe, stripe).add(dynamicLighting);

    return mat;
}

/**
 * Creates a TSL material for energy conduits (pulsing pipes).
 * Visuals:
 * - Base dark metal pipe
 * - Glowing core that pulses with sine wave
 */
export function createPulsingConduitMaterial(baseColorHex: number, glowColorHex: number, pulseSpeed: number, uPlayerPos: any, weaponLights: any) {
    if (shouldUseLiteMaterials()) {
        return createLiteIndustrialMaterial(baseColorHex, 0.4, 0.9, uPlayerPos);
    }

    const mat = new MeshStandardNodeMaterial({
        color: baseColorHex,
        roughness: 0.4,
        metalness: 0.9,
    });

    // --- Dynamic Lighting (Player Glow & Weapon Lights) ---
    const uInteractionRadius = uniform(30.0);
    const distToPlayer = length(positionWorld.sub(uPlayerPos));
    const playerGlowIntensity = smoothstep(uInteractionRadius, 0.0, distToPlayer);
    const uPlayerGlowColor = uniform(new THREE.Color(0xff8844)); // Orange engine glow

    const weaponGlow = float(0.0).toVar();
    const uWeaponColor = uniform(new THREE.Color(0x00ffff)); // Cyan weapon glow
    Loop({ start: 0, end: 20 }, ({ i }) => {
        const lightData = weaponLights.element(i);
        const lightPos = lightData.xyz;
        const lightIntensity = lightData.w;
        const distToLight = length(positionWorld.sub(lightPos));
        const wGlow = smoothstep(50.0, 0.0, distToLight).mul(lightIntensity);
        weaponGlow.addAssign(wGlow);
    });

    const dynamicLighting = uPlayerGlowColor.mul(playerGlowIntensity.mul(0.5)).add(uWeaponColor.mul(weaponGlow.mul(0.8)));

    // Pass uniforms to userData so they can be updated
    mat.userData.uPlayerPos = uPlayerPos;


    const uTime = time;
    const vUv = uv();

    // Simulate a glowing liquid/energy flowing through the pipe
    // We assume the pipe is a cylinder mapped such that V is along length or U is along length.
    // Usually cylinder U wraps around, V is height.
    // Let's assume V is along the length (vertical cylinder) or X axis if rotated.

    // Energy flow calculation (Traveling Light Pulses)
    // We want a glowing segment to travel along the UV x-axis (length of the conduit)

    // Create a scrolling coordinate based on time and pulse speed
    const scrollPos = vUv.y.sub(uTime.mul(pulseSpeed));

    // Use fract to repeat the pulse along the length of the pipe
    const repeatPattern = fract(scrollPos.mul(3.0));

    // Create a sharp, traveling glowing segment using smoothstep
    const travelingPulse = smoothstep(0.8, 1.0, repeatPattern);

    // Add a secondary, faster, smaller pulse for visual complexity
    const scrollPosFast = vUv.y.sub(uTime.mul(pulseSpeed * 1.5));
    const repeatPatternFast = fract(scrollPosFast.mul(5.0));
    const travelingPulseFast = smoothstep(0.9, 1.0, repeatPatternFast).mul(0.5);

    const combinedPulse = travelingPulse.add(travelingPulseFast).clamp(0.0, 1.0);

    const glowColor = color(glowColorHex);

    // Add a very subtle global glow to the pipe so it's not entirely black
    const baseGlow = glowColor.mul(0.1);

    // Final emissive combining the traveling pulse, base glow, and dynamic lighting
    mat.emissiveNode = glowColor.mul(combinedPulse).mul(3.0).add(baseGlow).add(dynamicLighting);

    return mat;
}

/**
 * Creates a procedural 3D gear geometry.
 */
export function createGearGeometry(radius: number, teeth: number, thickness: number) {
    const shape = new THREE.Shape();
    const toothDepth = radius * 0.2;
    const holeRadius = radius * 0.3;

    // Generate gear profile
    const steps = teeth * 2;
    const angleStep = (Math.PI * 2) / steps;

    for (let i = 0; i < steps; i++) {
        const angle = i * angleStep;
        // Use simpler logic: Outer point, then inner point
        const r = (i % 2 === 0) ? radius : radius - toothDepth;
        const x = Math.cos(angle) * r;
        const y = Math.sin(angle) * r;
        if (i === 0) shape.moveTo(x, y);
        else shape.lineTo(x, y);
    }
    shape.closePath();

    // Central hole
    const holePath = new THREE.Path();
    holePath.absarc(0, 0, holeRadius, 0, Math.PI * 2, false);
    shape.holes.push(holePath);

    const extrudeSettings = {
        depth: thickness,
        bevelEnabled: true,
        bevelThickness: 0.05,
        bevelSize: 0.05,
        bevelSegments: 2
    };

    return new THREE.ExtrudeGeometry(shape, extrudeSettings);
}

/**
 * Creates a piston head geometry (Cylinder with a plate).
 */
export function createPistonGeometry(radius: number, height: number) {
    return new THREE.CylinderGeometry(radius, radius, height, 16);
}

/**
 * Creates a rusty mechanical material using TSL.
 */
export function createMechanismMaterial(colorHex: number, uPlayerPos: any, weaponLights: any) {
    if (shouldUseLiteMaterials()) {
        return createLiteIndustrialMaterial(colorHex, 0.8, 0.6, uPlayerPos);
    }

    const mat = new MeshStandardNodeMaterial({
        color: colorHex,
        roughness: 0.8,
        metalness: 0.6
    });

    // --- Dynamic Lighting (Player Glow & Weapon Lights) ---
    const uInteractionRadius = uniform(30.0);
    const distToPlayer = length(positionWorld.sub(uPlayerPos));
    const playerGlowIntensity = smoothstep(uInteractionRadius, 0.0, distToPlayer);
    const uPlayerGlowColor = uniform(new THREE.Color(0xff8844)); // Orange engine glow

    const weaponGlow = float(0.0).toVar();
    const uWeaponColor = uniform(new THREE.Color(0x00ffff)); // Cyan weapon glow
    Loop({ start: 0, end: 20 }, ({ i }) => {
        const lightData = weaponLights.element(i);
        const lightPos = lightData.xyz;
        const lightIntensity = lightData.w;
        const distToLight = length(positionWorld.sub(lightPos));
        const wGlow = smoothstep(50.0, 0.0, distToLight).mul(lightIntensity);
        weaponGlow.addAssign(wGlow);
    });

    const dynamicLighting = uPlayerGlowColor.mul(playerGlowIntensity.mul(0.5)).add(uWeaponColor.mul(weaponGlow.mul(0.8)));

    // Pass uniforms to userData so they can be updated
    mat.userData.uPlayerPos = uPlayerPos;


    // Add rust/noise pattern using TSL
    const uTime = time;
    const pos = uv().mul(10.0);
    // Simple noise for rust
    const noise = sin(pos.x.mul(10.0)).mul(cos(pos.y.mul(10.0))).add(1.0).mul(0.5);

    // Mix rust color
    const baseColor = color(new THREE.Color(colorHex));
    const rustColor = color(0x8b4513); // SaddleBrown

    mat.colorNode = vec4(mix(baseColor, rustColor, noise.mul(0.3)), 1.0);
    mat.emissiveNode = dynamicLighting;
    return mat;
}

/**
 * Creates a material for foreground silhouette structures.
 * Visuals:
 * - Dark, almost black metal
 * - High roughness (rusty/dusty)
 * - Slight rim light via metalness? Or just dark.
 */
export function createForegroundMaterial(uPlayerPos: any, weaponLights: any) {
    if (shouldUseLiteMaterials()) {
        return createLiteIndustrialMaterial(0x1a1a1a, 0.9, 0.2, uPlayerPos);
    }

    const mat = new MeshStandardNodeMaterial({
        color: 0x1a1a1a,
        roughness: 0.9,
        metalness: 0.2,
    });

    // --- Dynamic Lighting (Player Glow & Weapon Lights) ---
    const uInteractionRadius = uniform(30.0);
    const distToPlayer = length(positionWorld.sub(uPlayerPos));
    const playerGlowIntensity = smoothstep(uInteractionRadius, 0.0, distToPlayer);
    const uPlayerGlowColor = uniform(new THREE.Color(0xff8844)); // Orange engine glow

    const weaponGlow = float(0.0).toVar();
    const uWeaponColor = uniform(new THREE.Color(0x00ffff)); // Cyan weapon glow
    Loop({ start: 0, end: 20 }, ({ i }) => {
        const lightData = weaponLights.element(i);
        const lightPos = lightData.xyz;
        const lightIntensity = lightData.w;
        const distToLight = length(positionWorld.sub(lightPos));
        const wGlow = smoothstep(50.0, 0.0, distToLight).mul(lightIntensity);
        weaponGlow.addAssign(wGlow);
    });

    const dynamicLighting = uPlayerGlowColor.mul(playerGlowIntensity.mul(0.5)).add(uWeaponColor.mul(weaponGlow.mul(0.8)));

    // Pass uniforms to userData so they can be updated
    mat.userData.uPlayerPos = uPlayerPos;

    mat.emissiveNode = dynamicLighting;
    return mat;
}

/**
 * Manages a layer of industrial background elements using InstancedMesh.
 */
export function createSimpleIndustrialMaterial(colorHex: number, r: number, m: number, uPlayerPos: any, weaponLights: any) {
    if (shouldUseLiteMaterials()) {
        return createLiteIndustrialMaterial(colorHex, r, m, uPlayerPos);
    }

    const mat = new MeshStandardNodeMaterial({
        color: colorHex,
        roughness: r,
        metalness: m
    });

    // --- Dynamic Lighting (Player Glow & Weapon Lights) ---
    const uInteractionRadius = uniform(30.0);
    const distToPlayer = length(positionWorld.sub(uPlayerPos));
    const playerGlowIntensity = smoothstep(uInteractionRadius, 0.0, distToPlayer);
    const uPlayerGlowColor = uniform(new THREE.Color(0xff8844)); // Orange engine glow

    const weaponGlow = float(0.0).toVar();
    const uWeaponColor = uniform(new THREE.Color(0x00ffff)); // Cyan weapon glow
    Loop({ start: 0, end: 20 }, ({ i }) => {
        const lightData = weaponLights.element(i);
        const lightPos = lightData.xyz;
        const lightIntensity = lightData.w;
        const distToLight = length(positionWorld.sub(lightPos));
        const wGlow = smoothstep(50.0, 0.0, distToLight).mul(lightIntensity);
        weaponGlow.addAssign(wGlow);
    });

    const dynamicLighting = uPlayerGlowColor.mul(playerGlowIntensity.mul(0.5)).add(uWeaponColor.mul(weaponGlow.mul(0.8)));

    // Pass uniforms to userData so they can be updated
    mat.userData.uPlayerPos = uPlayerPos;

    mat.emissiveNode = dynamicLighting;
    return mat;
}

export function createTunnelMaterial(speed: number, uPlayerPos: any, weaponLights: any) {
    if (shouldUseLiteMaterials()) {
        return createLiteIndustrialMaterial(0x332211, 0.8, 0.5, uPlayerPos, { uCameraX: { value: 0 } }, THREE.BackSide);
    }

    const mat = new MeshStandardNodeMaterial({
        color: 0x332211,
        roughness: 0.8,
        metalness: 0.5,
        side: THREE.BackSide // Render inside of cylinder
    });

    // --- Dynamic Lighting (Player Glow & Weapon Lights) ---
    const uInteractionRadius = uniform(30.0);
    const distToPlayer = length(positionWorld.sub(uPlayerPos));
    const playerGlowIntensity = smoothstep(uInteractionRadius, 0.0, distToPlayer);
    const uPlayerGlowColor = uniform(new THREE.Color(0xff8844)); // Orange engine glow

    const weaponGlow = float(0.0).toVar();
    const uWeaponColor = uniform(new THREE.Color(0x00ffff)); // Cyan weapon glow
    Loop({ start: 0, end: 20 }, ({ i }) => {
        const lightData = weaponLights.element(i);
        const lightPos = lightData.xyz;
        const lightIntensity = lightData.w;
        const distToLight = length(positionWorld.sub(lightPos));
        const wGlow = smoothstep(50.0, 0.0, distToLight).mul(lightIntensity);
        weaponGlow.addAssign(wGlow);
    });

    const dynamicLighting = uPlayerGlowColor.mul(playerGlowIntensity.mul(0.5)).add(uWeaponColor.mul(weaponGlow.mul(0.8)));

    // Pass uniforms to userData so they can be updated
    mat.userData.uPlayerPos = uPlayerPos;


    const uTime = time;
    const uCameraX = uniform(0.0);

    // UVs are wrapped around cylinder. U is around, V is length?
    // CylinderGeometry: "radial segments" (U), "height segments" (V).
    // Standard UV: U goes 0-1 around, V goes 0-1 along height (X axis in our rotation).
    const vUv = uv();

    // Scroll V based on camera X to simulate infinite tunnel
    // Factor 0.01 implies texture repeats every 100 units?
    const scrollV = vUv.y.add(uCameraX.mul(0.02));

    // Grid/Panel Pattern
    // U is 0-1 (circumference ~ 2*PI*60 ~ 376). V is length (300).
    // We want square panels.
    const panelU = vUv.x.mul(12.0); // 12 panels around
    const panelV = scrollV.mul(10.0); // 10 panels along length

    const grid = step(0.95, fract(panelU)).add(step(0.95, fract(panelV))).clamp(0.0, 1.0);

    // Tech Details (Noise inside panels)
    const detailNoise = sin(panelU.mul(5.0)).mul(cos(panelV.mul(5.0))).add(1.0).mul(0.5);

    // Color Mix
    const wallColor = color(0x221105); // Dark Rusty
    const gridColor = color(0x110800); // Darker Seams
    const lightColor = color(0xff6600); // Orange accents

    // Random lights based on panel index
    const panelId = panelU.floor().add(panelV.floor().mul(10.0));
    const lightProb = sin(panelId).add(1.0).mul(0.5); // 0..1 random-ish
    const isLight = step(0.9, lightProb); // 10% chance of light

    // Pulse lights
    const pulse = sin(uTime.mul(2.0).add(panelId)).add(1.0).mul(0.5);

    mat.colorNode = vec4(mix(wallColor, gridColor, grid), 1.0);

    // Emissive lights
    mat.emissiveNode = mix(color(0x000000), lightColor.mul(pulse), isLight.mul(float(1.0).sub(grid))).add(dynamicLighting);

    mat.userData.uCameraX = uCameraX;

    return mat;
}
