import * as THREE from 'three';
import {
    MeshBasicNodeMaterial
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
    positionLocal,
    positionWorld,
    fract,
    step,
    length
} from 'three/tsl';
import { decorationBudget } from './decoration_budget';

export interface CosmicCyberGridConfig {
    enabled: boolean;
    speedMultiplier?: number;
    color?: number;
}

function createGridMaterial(gridColor: number, uSpeed: any) {
    const mat = new MeshBasicNodeMaterial({
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
    });

    const cGrid = color(gridColor);

    // UV scrolling based on time and speed
    const scrollUv = uv().add(vec2(0.0, time.mul(uSpeed).mul(2.0)));

    // Procedural grid lines
    const lineThickness = float(0.05);
    const gridScale = float(10.0);

    // Scale UVs
    const scaledUv = scrollUv.mul(gridScale);

    // Grid pattern
    const gridX = step(fract(scaledUv.x), lineThickness);
    const gridY = step(fract(scaledUv.y), lineThickness);
    const grid = gridX.add(gridY).clamp(0.0, 1.0);

    // Fade out at distance (edges of the plane)
    const fadeDistance = float(200.0);
    const distToCenter = length(positionLocal.xz); // plane is laying flat (rotateX)
    // The geometry is a PlaneGeometry(400, 400), we want to fade it out at the edges
    const fade = float(1.0).sub(smoothstep(fadeDistance.mul(0.2), fadeDistance, distToCenter));

    mat.colorNode = cGrid;
    mat.opacityNode = grid.mul(fade).mul(0.8); // 80% opacity for the grid lines

    // Undulate the grid vertically
    // We modify positionLocal in the vertex shader
    const waveFreq = float(0.05);
    const waveAmp = float(10.0);
    const waveSpeed = float(5.0);

    const wave = sin(positionLocal.x.mul(waveFreq).add(time.mul(waveSpeed).mul(uSpeed))).mul(waveAmp);

    mat.positionNode = positionLocal.add(vec3(0.0, wave, 0.0));

    return mat;
}

export class CosmicCyberGridSystem {
    scene: THREE.Scene;
    active: boolean = false;
    mesh: THREE.Mesh;
    uSpeed = uniform(float(1.0));
    config: CosmicCyberGridConfig = { enabled: false };

    constructor(scene: THREE.Scene) {
        this.scene = scene;

        // Very large plane for the grid horizon
        const geo = new THREE.PlaneGeometry(800, 800, 64, 64);
        // Rotate so it lays flat on the ground
        geo.rotateX(-Math.PI / 2);

        const mat = createGridMaterial(0xff00ff, this.uSpeed); // default neon pink

        this.mesh = new THREE.Mesh(geo, mat);
        // Position it below the player
        this.mesh.position.y = -60;
        this.mesh.frustumCulled = false;

        this.scene.add(this.mesh);
        this.deactivate();
    }

    activate(config?: CosmicCyberGridConfig) {
        if (this.active) return;
        this.active = true;
        this.config = config || { enabled: true };
        this.mesh.visible = true;

        if (this.config.color !== undefined) {
            // we could update a uniform color, but let's re-create mat for now
            const mat = createGridMaterial(this.config.color, this.uSpeed);
            if (this.mesh.material) {
                (this.mesh.material as any).dispose?.();
            }
            this.mesh.material = mat;
        }

        decorationBudget.syncCount('cosmic_cyber_grid', 1);
    }

    deactivate() {
        if (!this.active) return;
        this.active = false;
        this.mesh.visible = false;
        decorationBudget.syncCount('cosmic_cyber_grid', 0);
    }

    update(delta: number, cameraX: number, playerSpeed: number = 8) {
        if (!this.active) return;

        const speedMultiplier = this.config.speedMultiplier ?? 1.0;
        this.uSpeed.value = playerSpeed * speedMultiplier;

        // Track the camera so the plane is always under us
        this.mesh.position.x = cameraX;
    }

    cleanup() {
        this.scene.remove(this.mesh);
        this.mesh.geometry.dispose();
        if (Array.isArray(this.mesh.material)) {
            this.mesh.material.forEach(m => m.dispose());
        } else {
            this.mesh.material.dispose();
        }
        decorationBudget.syncCount('cosmic_cyber_grid', 0);
    }
}
