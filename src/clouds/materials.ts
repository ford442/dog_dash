import * as THREE from 'three';
import {
    MeshBasicNodeMaterial
} from 'three/webgpu';
import {
    time,
    Loop,
    positionLocal,
    positionWorld,
    uv,
    vec2,
    vec3,
    vec4,
    color,
    uniform,
    sin,
    float,
    length,
    smoothstep,
    dot,
    max,
    distance
, cameraPosition } from 'three/tsl';
import { fbm } from './noise';

/**
 * Creates a TSL material for cloud sprites (billboards).
 * Features:
 * - Procedural shape (Soft circle + Noise erosion)
 * - Billowing animation (Time-based noise offset)
 * - Internal lighting/shading simulation via noise density
 * - Volumetric Lightning Flash (Distance-based)
 */
export function createCloudSpriteMaterial(uBaseColor: any, uOpacity: any, detail: number = 1.0, weaponLights?: any, uPlayerPos?: any) {
    const mat = new MeshBasicNodeMaterial({
        transparent: true,
        side: THREE.FrontSide, // Sprites face camera
        depthWrite: false, // Soft blending
        blending: THREE.NormalBlending // Standard alpha blending
    });

    const uTime = time;
    const uBillowSpeed = uniform(0.2);
    const uFlash = uniform(0.0);
    const uDetail = uniform(detail);

    // Volumetric Lightning Uniforms
    const uLightningPos = uniform(new THREE.Vector3(0, 0, 0));
    const uLightningRadius = uniform(50.0);
    const uLightningColor = uniform(new THREE.Color(0xffffff));

    // --- Fragment Shader ---
    const vUv = uv();

    // Center UVs to -0.5 to 0.5 for radial calculations
    const centeredUv = vUv.sub(0.5);
    const dist = length(centeredUv).mul(2.0); // 0 at center, 1 at edge

    // 1. Base Shape (Soft Circle)
    const core = float(1.0).sub(dist); // 1 at center, 0 at edge
    const softShape = smoothstep(0.0, 0.2, core); // Soft edge fade

    // 2. Procedural Noise (Texture)
    // Scale UVs for noise
    const noiseUv = vUv.mul(3.0).mul(uDetail);

    // Animate noise for billowing effect
    // We scroll the noise domain slightly and evolve z-slice (if 3d) or just offset
    const scroll = vec2(uTime.mul(uBillowSpeed).mul(0.5), uTime.mul(uBillowSpeed).mul(0.2));
    const noiseVal = fbm(noiseUv.add(scroll));

    // 3. Erode shape with noise
    // Combine shape and noise.
    // Edges get more eroded. Center stays denser.
    const density = softShape.mul(noiseVal.add(0.2));

    // Sharpen alpha slightly to define puff
    const alpha = smoothstep(0.1, 0.6, density).mul(uOpacity);

    // 4. Color & Lighting
    const baseColor = color(uBaseColor);

    // internal shadows: darker where noise is low (crevices)
    const shadowFactor = noiseVal.mul(0.5).add(0.5);
    const finalColor = baseColor.mul(shadowFactor);


    // --- Dynamic Physical Deform (Jitter) ---
    // When lightning hits (uFlash > 0), the cloud physically bulges/pulses
    // We use noiseVal and positionLocal to calculate an offset.
    const jitterFactor = uFlash.mul(noiseVal).mul(1.5);
    // Expand the cloud outward slightly when flashing
    mat.positionNode = vec3(positionLocal.x.add(positionLocal.x.mul(jitterFactor)), positionLocal.y.add(positionLocal.y.mul(jitterFactor)), positionLocal.z);

    // 5. Volumetric Lightning Flash
    // Calculate distance from this fragment (in world space) to the lightning strike
    const distToStrike = distance(positionWorld, uLightningPos);

    // Attenuation: 1.0 at center, 0.0 at radius
    const attenuation = smoothstep(uLightningRadius, float(0.0), distToStrike);

    // Fake normal based on UV from center for directional rim lighting
    const fakeNormal = vec3(centeredUv.x, centeredUv.y, 0.5).normalize();
    const lightDir = uLightningPos.sub(positionWorld).normalize(); // FROM fragment TO light
    const lightIntensity = dot(fakeNormal, lightDir).max(0.0).mul(0.5).add(0.5);

    // Silver Lining Effect (Rim Lighting when light is behind the cloud)
    const viewDir = cameraPosition.sub(positionWorld).normalize();
    // dot(viewDir, lightDir) is -1 when light is directly behind cloud
    const backlight = dot(viewDir, lightDir).negate().max(0.0);
    const edgeFactor = smoothstep(0.2, 0.8, dist); // 1.0 at edge, 0.0 at center
    const silverLining = backlight.mul(edgeFactor).mul(2.0); // Boost edge brightness

    const totalLightIntensity = lightIntensity.add(silverLining);

    // Flash adds volumetric emissive boost based on attenuation, noise density and intensity
    const flashColor = color(uLightningColor);

    // Use noiseVal to highlight the cloud's internal structure during flash
    const volumetricHighlight = noiseVal.add(0.5);
    // Include a height-based component (y-axis) so foreground/higher clouds flash more brightly
    const heightBoost = positionWorld.y.div(50.0).add(1.0).clamp(0.5, 2.0);
    const flashFactor = uFlash.mul(attenuation).mul(volumetricHighlight).mul(totalLightIntensity).mul(heightBoost);

    // Make the flash additive rather than just a mix for a more powerful volumetric explosion
    const flashedColor = finalColor.add(flashColor.mul(flashFactor));

    let enhancedColor = flashedColor;

    if (uPlayerPos !== undefined && weaponLights !== undefined) {
        // Player Engine Glow Interaction
        const distToPlayer = length(positionWorld.sub(uPlayerPos));
        const glowIntensity = smoothstep(30.0, 0.0, distToPlayer);
        const uGlowColor = uniform(new THREE.Color(0xff8844)); // Engine glow

        // Weapon Light Interaction
        const weaponGlow = float(0.0).toVar();
        const uWeaponColor = uniform(new THREE.Color(0x00ffff));

        Loop({ start: 0, end: 20 }, ({ i }) => {
            const lightData = weaponLights.element(i);
            const lightPos = lightData.xyz;
            const lightIntensity = lightData.w;

            const distToLight = distance(positionWorld, lightPos);
            const lightRadius = float(25.0);
            const falloff = smoothstep(lightRadius, 0.0, distToLight);

            weaponGlow.addAssign(falloff.mul(lightIntensity));
        });

        enhancedColor = enhancedColor.add(uGlowColor.mul(glowIntensity.mul(0.6))).add(uWeaponColor.mul(weaponGlow.mul(0.8)));
    }

    mat.colorNode = vec4(enhancedColor, alpha);

    // Store uniforms
    if (uPlayerPos !== undefined) {
        mat.userData.uPlayerPos = uPlayerPos;
    }

    mat.userData.uFlash = uFlash;
    mat.userData.uLightningPos = uLightningPos;
    mat.userData.uLightningRadius = uLightningRadius;
    mat.userData.uLightningColor = uLightningColor;

    return mat;
}
