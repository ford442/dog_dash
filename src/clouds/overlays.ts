import * as THREE from 'three';
import {
    MeshBasicNodeMaterial
} from 'three/webgpu';
import {
    time,
    uv,
    vec2,
    vec4,
    color,
    uniform,
    sin,
    float,
    length,
    smoothstep
} from 'three/tsl';

export class GodRayOverlay {
    mesh: THREE.Mesh;
    camera: THREE.Camera | null = null;
    uIntensity: any;
    uLightPos: any;

    constructor() {
        const geo = new THREE.PlaneGeometry(2, 2);
        this.uIntensity = uniform(0.0);
        this.uLightPos = uniform(new THREE.Vector2(0.5, 0.5));

        const mat = new MeshBasicNodeMaterial({
            transparent: true,
            depthWrite: false,
            depthTest: false,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending
        });

        // screenUV or uv()
        const vUv = uv();
        const deltaTextCoord = vUv.sub(this.uLightPos);
        const textCoo = vUv.sub(deltaTextCoord.mul(0.5));

        const dist = length(vUv.sub(0.5));

        // Let's create a radial blur / god ray effect from lightPos
        // We use a basic loop or accumulation if needed, but since it's TSL, let's keep it simple
        const rayColor = color(0xffffff); // Godray color

        // Simplified god rays using noise/distance
        const rayIntensity = float(1.0).sub(dist).mul(this.uIntensity).clamp(0, 1);
        const radialPulse = sin(time.mul(10.0).add(length(deltaTextCoord).mul(20.0))).mul(0.1).add(0.9);

        const alpha = rayIntensity.mul(0.5).mul(radialPulse);

        mat.colorNode = vec4(rayColor, alpha);

        this.mesh = new THREE.Mesh(geo, mat);
        this.mesh.position.set(0, 0, -1.01); // Just behind UI
    }

    init(camera: THREE.Camera) {
        this.camera = camera;
        camera.add(this.mesh);
    }

    update(delta: number) {
        if (this.uIntensity.value > 0.0) {
            this.uIntensity.value = Math.max(0, this.uIntensity.value - delta * 2.0);
        }
    }
}


export class LightningFlashOverlay {
    mesh: THREE.Mesh;
    camera: THREE.Camera | null = null;
    uIntensity: any;

    constructor() {
        const geo = new THREE.PlaneGeometry(2, 2);
        this.uIntensity = uniform(0.0);

        const mat = new MeshBasicNodeMaterial({
            transparent: true,
            depthWrite: false,
            depthTest: false,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending
        });

        const vUv = uv();
        const dist = length(vUv.sub(0.5)).mul(1.5);
        const vignette = smoothstep(0.4, 1.2, dist);
        const flashColor = color(0xffffff); // Bright white/blue flash
        // Base flash across screen, stronger at edges
        const alpha = float(0.3).add(vignette.mul(0.7)).mul(this.uIntensity).mul(0.6);

        mat.colorNode = vec4(flashColor, alpha);

        this.mesh = new THREE.Mesh(geo, mat);
        this.mesh.position.set(0, 0, -1.02); // Just behind UI
    }

    init(camera: THREE.Camera) {
        this.camera = camera;
        camera.add(this.mesh);
    }

    update(delta: number) {
        if (this.uIntensity.value > 0.0) {
            this.uIntensity.value = Math.max(0, this.uIntensity.value - delta * 4.0);
        }
    }
}
