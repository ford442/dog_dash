import * as THREE from 'three';
import { MeshBasicNodeMaterial, MeshStandardNodeMaterial } from 'three/webgpu';
import {
    time, positionLocal, positionWorld, uv, vec2, vec3, vec4, color, uniform,
    mix, sin, cos, float, step, fract, pow, length, smoothstep, distance,
    Loop, cameraPosition, dot
} from 'three/tsl';

/**
 * Creates a TSL material for a nebula cloud puff.
 */
export function createNebulaMaterial(
    baseColorHex: number,
    secondaryColorHex: number,
    opacity: number,
    uGlobalPulse: any,
    weaponLights: any, // storage node
    uMagicIntensity: any
) {
    const mat = new MeshStandardNodeMaterial({
        transparent: true,
        opacity: opacity,
        side: THREE.FrontSide,
        depthWrite: false,
        blending: THREE.NormalBlending,
        roughness: 1.0,
        metalness: 0.0
    });

    const uTime = time;
    const uPulseSpeed = uniform(0.5);
    const uPlayerPos = uniform(new THREE.Vector3(0, 0, 0)); // Player position
    const uInteractionRadius = uniform(20.0); // Radius of glow effect
    const uGlowColor = uniform(new THREE.Color(0xffaa00)); // Engine/Exhaust glow color
    const uWeaponColor = uniform(new THREE.Color(0x00ffff)); // Cyan weapon color

    // --- Fragment Shader ---
    const pos = positionLocal.mul(0.5); // Scale noise

    // Simple 3D noise approximation
    const noise1 = sin(pos.x.add(uTime.mul(0.2))).mul(cos(pos.y.add(uTime.mul(0.3))));
    const noise2 = cos(pos.z.add(uTime.mul(0.1))).mul(sin(pos.x.mul(2.0)));
    const combinedNoise = noise1.add(noise2).mul(0.5).add(0.5); // 0..1

    // Radial gradient from center
    const dist = length(pos.mul(2.0));
    const core = float(1.0).sub(dist);
    const softCore = core.pow(2.0);

    // Combine noise and core
    const density = softCore.mul(combinedNoise.add(0.5));

    // 2. Color Shift
    const col1 = color(new THREE.Color(baseColorHex));
    const col2 = color(new THREE.Color(secondaryColorHex));

    // Whimsical Pastel variants
    const pastelColor1 = mix(col1, color(0xffffff), 0.4); // Lighten
    const pastelColor2 = mix(col2, color(0xe6e6fa), 0.5); // Lavender tint

    const pulseMix = mix(float(0.0), float(1.0), uGlobalPulse.add(uMagicIntensity).clamp(0.0, 1.0));

    // Interpolate with pastel variants based on global pulse and magic intensity
    const magicColor1 = mix(col1, pastelColor1, pulseMix);
    const magicColor2 = mix(col2, pastelColor2, pulseMix);

    // Pulse between colors
    const pulse = sin(uTime.mul(uPulseSpeed)).add(1.0).mul(0.5);
    let finalColor: any = mix(magicColor1, magicColor2, pulse.mul(combinedNoise));

    // 3. Dynamic Player Interaction
    const distToPlayer = length(positionWorld.sub(uPlayerPos));
    const glowIntensity = smoothstep(uInteractionRadius, 0.0, distToPlayer);

    // Petal-like ripple effect
    const ripple = sin(distToPlayer.mul(2.0).sub(uTime.mul(5.0))).add(1.0).mul(0.5);
    const magicRipple = mix(float(1.0), ripple, uMagicIntensity);

    // Silver Lining Effect (Rim Lighting when player light is behind the nebula relative to camera)
    const viewDir = cameraPosition.sub(positionWorld).normalize();
    const lightDir = uPlayerPos.sub(positionWorld).normalize(); // from fragment to player
    const backlight = dot(viewDir, lightDir).negate().max(0.0);
    // Use softCore (0 to 1 based on density) for edge factor
    const edgeFactor = smoothstep(0.35, 0.85, float(1.0).sub(density));

    // Smooth threshold for backlight to avoid flickering
    const backlightSmooth = smoothstep(0.0, 0.6, backlight);
    const silverLining = backlightSmooth.mul(edgeFactor).mul(glowIntensity).mul(1.2); // Tuned for nebula

    const basePlayerGlow = uGlowColor.mul(glowIntensity.mul(0.8).mul(magicRipple));
    const silverLiningColor = color(new THREE.Color(0xffffff)).mul(silverLining);

    finalColor = finalColor.add(basePlayerGlow).add(silverLiningColor);

    // 4. Weapon Light Interaction
    const weaponGlow = float(0.0).toVar();

    Loop({ start: 0, end: 20 }, ({ i }) => {
        const lightData = weaponLights.element(i);
        const lightPos = lightData.xyz;
        const lightIntensity = lightData.w;

        const distToLight = distance(positionWorld, lightPos);
        const lightRadius = float(15.0);
        const falloff = smoothstep(lightRadius, 0.0, distToLight);

        weaponGlow.addAssign(falloff.mul(lightIntensity));
    });

    finalColor = finalColor.add(uWeaponColor.mul(weaponGlow.mul(0.5)));

    // 5. Global Harmonic Pulse
    const harmonicBoost = uGlobalPulse.mul(0.3).add(uMagicIntensity.mul(0.5)); // Boost with magic
    finalColor = finalColor.add(harmonicBoost.mul(col2));

    mat.colorNode = vec4(finalColor, density.mul(opacity));

    // Add rim lighting strongly into emissive only, to avoid washing out alpha
    mat.emissiveNode = finalColor.mul(0.2).add(silverLiningColor);

    // Expose uniform for updates
    mat.userData.uPlayerPos = uPlayerPos;

    return mat;
}

/**
 * Creates a TSL material for energy particles (sparkles).
 */
export function createEnergyParticleMaterial(colorHex: number, uGlobalPulse: any) {
    const mat = new MeshBasicNodeMaterial({
        transparent: true,
        side: THREE.FrontSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    const uTime = time;
    const pos = positionLocal;
    const phase = pos.x.mul(10.0).add(pos.y.mul(20.0)).add(pos.z.mul(30.0));
    const sparkle = sin(uTime.mul(5.0).add(phase)).add(1.0).mul(0.5);
    const sharpSparkle = pow(sparkle, 4.0);
    const globalSync = uGlobalPulse.mul(0.5).add(0.5);
    const baseColor = color(new THREE.Color(colorHex));

    mat.colorNode = vec4(baseColor, sharpSparkle.mul(globalSync));

    return mat;
}

/**
 * Creates a TSL material for the Pulse Overlay (Screen Breathing).
 */
export function createPulseOverlayMaterial(uPulse: any) {
    const mat = new MeshBasicNodeMaterial({
        transparent: true,
        opacity: 1.0,
        depthTest: false,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending
    });

    const vUv = uv();
    const dist = length(vUv.sub(0.5)).mul(1.5);
    const vignette = smoothstep(0.4, 1.2, dist);
    const pulseColor = color(0x6600cc);
    const alpha = vignette.mul(uPulse).mul(0.2);

    mat.colorNode = vec4(pulseColor, alpha);

    return mat;
}
