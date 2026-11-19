import * as THREE from 'three';

/**
 * The obstacle's "surface" material: the one whose colour the depth fade and
 * the candy power-up recolour. Kit asteroids with ore veins carry a
 * `[rock, vein]` material array; the rock (index 0) is the surface.
 */
export function primaryMaterial(obs: THREE.Mesh): THREE.MeshStandardMaterial {
    const mat = Array.isArray(obs.material) ? obs.material[0] : obs.material;
    return mat as THREE.MeshStandardMaterial;
}

/** Colour the depth fade scales from. Captured from the material on first use. */
export function getObstacleBaseColor(obs: THREE.Mesh): THREE.Color {
    let base = obs.userData.baseColor as THREE.Color | undefined;
    if (!base) {
        base = primaryMaterial(obs).color.clone();
        obs.userData.baseColor = base;
    }
    return base;
}

/** Recolour an obstacle's surface and make the depth fade keep the new colour. */
export function setObstacleSurfaceColor(obs: THREE.Mesh, hex: number): void {
    const mat = primaryMaterial(obs);
    mat.color.setHex(hex);
    obs.userData.baseColor = mat.color.clone();
}

/**
 * Darken obstacles that sit away from the play plane (|z| > 1) so depth reads.
 * Scales the obstacle's own base colour, so hue (chapter palette, enemy
 * identity, candy colour) survives; the old code reset everything to grey.
 */
export function applyObstacleDepthFade(obs: THREE.Mesh): void {
    const mat = primaryMaterial(obs);
    if (!mat?.color) return;
    const base = getObstacleBaseColor(obs);
    const zDepth = Math.abs(obs.position.z);
    const brightness = zDepth > 1.0 ? 1.0 - Math.min(1.0, zDepth / 25.0) * 0.9 : 1.0;
    mat.color.copy(base).multiplyScalar(brightness);
}
