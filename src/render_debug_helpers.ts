import * as THREE from 'three';
import type { GameRenderer, RendererBackend } from './renderer_mode';

export type CollisionDebugTarget = {
    position: THREE.Vector3;
    radius: number;
    color?: number;
};

function forEachMaterial(object: THREE.Object3D, visit: (material: THREE.Material) => void): void {
    const material = (object as THREE.Mesh).material;
    if (!material) return;

    if (Array.isArray(material)) {
        material.forEach(visit);
    } else {
        visit(material);
    }
}

export class WireframeDebugHelper {
    private readonly originalWireframe = new Map<THREE.Material, boolean>();

    update(scene: THREE.Scene, enabled: boolean): void {
        if (enabled) {
            scene.traverse((object) => {
                forEachMaterial(object, (material) => {
                    if (!('wireframe' in material)) return;
                    const wireMaterial = material as THREE.Material & { wireframe: boolean };
                    if (!this.originalWireframe.has(material)) {
                        this.originalWireframe.set(material, wireMaterial.wireframe);
                    }
                    wireMaterial.wireframe = true;
                });
            });
            return;
        }

        for (const [material, wireframe] of this.originalWireframe) {
            if ('wireframe' in material) {
                (material as THREE.Material & { wireframe: boolean }).wireframe = wireframe;
            }
        }
        this.originalWireframe.clear();
    }
}

export class CollisionDebugOverlay {
    private readonly group = new THREE.Group();
    private readonly sphereGeometry = new THREE.SphereGeometry(1, 16, 8);
    private readonly meshes: THREE.Mesh[] = [];

    constructor(scene: THREE.Scene) {
        this.group.name = 'collision-debug-overlay';
        this.group.visible = false;
        scene.add(this.group);
    }

    update(enabled: boolean, targets: CollisionDebugTarget[]): void {
        this.group.visible = enabled;
        if (!enabled) return;

        for (let i = this.meshes.length; i < targets.length; i++) {
            const material = new THREE.MeshBasicMaterial({
                color: 0x00ff66,
                wireframe: true,
                transparent: true,
                opacity: 0.65,
                depthTest: false
            });
            const mesh = new THREE.Mesh(this.sphereGeometry, material);
            mesh.renderOrder = 999;
            this.meshes.push(mesh);
            this.group.add(mesh);
        }

        for (let i = 0; i < this.meshes.length; i++) {
            const mesh = this.meshes[i];
            const target = targets[i];

            mesh.visible = i < targets.length;
            if (!target) continue;

            mesh.position.copy(target.position);
            mesh.scale.setScalar(Math.max(0.01, target.radius));
            const material = mesh.material as THREE.MeshBasicMaterial;
            material.color.setHex(target.color ?? 0x00ff66);
        }
    }
}

function isNodeMaterial(material: THREE.Material): boolean {
    const name = material.constructor?.name || '';
    return name.includes('NodeMaterial')
        || 'colorNode' in material
        || 'emissiveNode' in material
        || 'positionNode' in material
        || 'opacityNode' in material;
}

function copyCommonMaterialProps(source: THREE.Material, target: THREE.Material): void {
    target.name = source.name;
    target.opacity = source.opacity;
    target.transparent = source.transparent;
    target.side = source.side;
    target.depthWrite = source.depthWrite;
    target.depthTest = source.depthTest;
    target.blending = source.blending;
    target.visible = source.visible;
    target.userData = source.userData;

    if ('alphaTest' in source && 'alphaTest' in target) {
        (target as THREE.Material & { alphaTest: number }).alphaTest =
            (source as THREE.Material & { alphaTest: number }).alphaTest;
    }

    if ('wireframe' in source && 'wireframe' in target) {
        (target as THREE.Material & { wireframe: boolean }).wireframe =
            (source as THREE.Material & { wireframe: boolean }).wireframe;
    }
}

function createWebGLCompatibleMaterial(source: THREE.Material): THREE.Material {
    if (source instanceof THREE.PointsMaterial) {
        const material = new THREE.PointsMaterial({
            color: source.color.clone(),
            size: source.size,
            sizeAttenuation: source.sizeAttenuation,
            transparent: source.transparent,
            opacity: source.opacity,
            blending: source.blending,
            depthWrite: source.depthWrite
        });
        copyCommonMaterialProps(source, material);
        return material;
    }

    if (source instanceof THREE.MeshBasicMaterial) {
        const material = new THREE.MeshBasicMaterial({
            color: source.color.clone(),
            map: source.map,
            transparent: source.transparent,
            opacity: source.opacity,
            side: source.side,
            blending: source.blending,
            depthWrite: source.depthWrite
        });
        copyCommonMaterialProps(source, material);
        return material;
    }

    const standardSource = source as THREE.MeshStandardMaterial;
    const material = new THREE.MeshStandardMaterial({
        color: standardSource.color?.clone() ?? new THREE.Color(0xffffff),
        map: standardSource.map ?? null,
        emissive: standardSource.emissive?.clone() ?? new THREE.Color(0x000000),
        emissiveIntensity: standardSource.emissiveIntensity ?? 0,
        roughness: standardSource.roughness ?? 0.8,
        metalness: standardSource.metalness ?? 0,
        flatShading: standardSource.flatShading ?? false,
        transparent: source.transparent,
        opacity: source.opacity,
        side: source.side,
        blending: source.blending,
        depthWrite: source.depthWrite
    });
    copyCommonMaterialProps(source, material);
    return material;
}

export function convertNodeMaterialsForWebGL(scene: THREE.Scene): number {
    let convertedCount = 0;

    scene.traverse((object) => {
        const material = (object as THREE.Mesh).material;
        if (!material) return;

        if (Array.isArray(material)) {
            const next = material.map((entry) => {
                if (!isNodeMaterial(entry)) return entry;
                convertedCount++;
                return createWebGLCompatibleMaterial(entry);
            });
            (object as THREE.Mesh).material = next;
            return;
        }

        if (isNodeMaterial(material)) {
            convertedCount++;
            (object as THREE.Mesh).material = createWebGLCompatibleMaterial(material);
        }
    });

    return convertedCount;
}

export class WebGLMaterialFallbackRenderer {
    private materialFallbackApplied = false;

    constructor(private readonly backend: RendererBackend) {}

    render(renderer: GameRenderer, scene: THREE.Scene, camera: THREE.Camera): void {
        if (this.backend !== 'webgl' || this.materialFallbackApplied) {
            renderer.render(scene, camera);
            return;
        }

        try {
            renderer.render(scene, camera);
        } catch (error) {
            const convertedCount = convertNodeMaterialsForWebGL(scene);
            this.materialFallbackApplied = true;
            console.warn(
                `[renderer] WebGL2 render failed with node materials; converted ${convertedCount} materials to standard WebGL materials.`,
                error
            );
            renderer.render(scene, camera);
        }
    }
}
