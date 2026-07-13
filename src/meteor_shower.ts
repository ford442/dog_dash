import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { time, vec4, vec3, color, mix, sin, positionLocal, positionWorld, length, smoothstep, uniform, Loop, distance, float } from 'three/tsl';
import { WeaponLightManager } from './lighting';

function createMeteorMaterial(opacityMultiplier: number = 1.0, weaponLights?: any, uPlayerPos?: any) {
    const mat = new MeshBasicNodeMaterial({
        transparent: true,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false
    });

    const uTime = time;

    // A fiery gradient from front to tail
    const coreColor = color(0xffffff); // white hot leading edge
    const midColor = color(0xffaa00);  // orange mid
    const tailColor = color(0xff2200); // red tail

    // Assuming BoxGeometry(0.5, 0.5, 20), z goes from -10 to 10
    // Normalize z to 0..1: (z / 20) + 0.5
    const normalizedZ = positionLocal.z.div(20.0).add(0.5);

    // Fluctuation based on time
    const flicker = sin(uTime.mul(20.0).add(positionLocal.z.mul(5.0))).mul(0.1).add(0.9);

    // Mix colors based on normalizedZ
    const colorMix1 = mix(tailColor, midColor, normalizedZ.mul(2.0));
    let finalColor: any = mix(colorMix1, coreColor, normalizedZ.mul(2.0).sub(1.0).clamp(0.0, 1.0));

    // Player Engine Glow Interaction
    if (uPlayerPos) {
        const distToPlayer = length(positionWorld.sub(uPlayerPos));
        const playerGlow = smoothstep(50.0, 0.0, distToPlayer).mul(0.6);
        finalColor = finalColor.add(vec3(1.0, 0.5, 0.2).mul(playerGlow));
    }

    // Weapon Projectile Interactions
    if (weaponLights) {
        const uWeaponColor = uniform(new THREE.Color(0x00ffff));
        const weaponGlow = float(0.0).toVar();

        Loop({ start: 0, end: 20 }, ({ i }) => {
            const lightData = weaponLights.element(i);
            const lightPos = lightData.xyz;
            const lightIntensity = lightData.w;

            const distToLight = distance(positionWorld, lightPos);
            const lightFactor = smoothstep(40.0, 0.0, distToLight).mul(lightIntensity);
            weaponGlow.addAssign(lightFactor);
        });

        finalColor = finalColor.add(uWeaponColor.mul(weaponGlow));
    }

    // Opacity fades out towards the tail
    const alpha = normalizedZ.mul(flicker).mul(opacityMultiplier);

    mat.colorNode = vec4(finalColor, alpha);

    return mat;
}

interface MeteorLayer {
    mesh: THREE.InstancedMesh;
    count: number;
    positions: Float32Array;
    velocities: Float32Array;
    zMin: number;
    zMax: number;
    speedMult: number;
    scale: number;
}

export class MeteorShowerSystem {
    scene: THREE.Scene;
    active: boolean = false;
    dummy: THREE.Object3D;
    weaponLightManager?: WeaponLightManager;
    uPlayerPos: any;

    layers: MeteorLayer[] = [];

    constructor(scene: THREE.Scene, weaponLightManager?: WeaponLightManager) {
        this.weaponLightManager = weaponLightManager;
        this.uPlayerPos = uniform(new THREE.Vector3(9999, 9999, 9999));
        this.scene = scene;
        this.dummy = new THREE.Object3D();

        const layerConfigs = [
            { count: 15, zMin: -30, zMax: -80, speedMult: 1.5, scale: 1.2, opacity: 1.0 }, // Foreground
            { count: 30, zMin: -80, zMax: -150, speedMult: 1.0, scale: 0.8, opacity: 0.8 }, // Midground
            { count: 50, zMin: -150, zMax: -300, speedMult: 0.5, scale: 0.5, opacity: 0.5 } // Background
        ];

        for (const config of layerConfigs) {
            const geo = new THREE.BoxGeometry(0.5 * config.scale, 0.5 * config.scale, 20 * config.scale);
            const weaponLights = this.weaponLightManager ? this.weaponLightManager.storageNode : undefined;
            const mat = createMeteorMaterial(config.opacity, weaponLights, this.uPlayerPos);

            const mesh = new THREE.InstancedMesh(geo, mat, config.count);
            mesh.frustumCulled = false; // Wrap manually

            const layer: MeteorLayer = {
                mesh,
                count: config.count,
                positions: new Float32Array(config.count * 3),
                velocities: new Float32Array(config.count * 3),
                zMin: config.zMin,
                zMax: config.zMax,
                speedMult: config.speedMult,
                scale: config.scale
            };

            for (let i = 0; i < layer.count; i++) {
                this.resetMeteor(layer, i, 0, true);
            }

            this.scene.add(layer.mesh);
            this.layers.push(layer);
        }

        this.deactivate();
    }

    resetMeteor(layer: MeteorLayer, index: number, cameraX: number, initial: boolean = false) {
        // Spawn ahead of the camera, or randomly around if initial
        const xOffset = initial ? (Math.random() * 400 - 100) : (100 + Math.random() * 200);
        layer.positions[index * 3] = cameraX + xOffset;
        layer.positions[index * 3 + 1] = (Math.random() - 0.5) * 150; // Y range
        layer.positions[index * 3 + 2] = layer.zMax + Math.random() * (layer.zMin - layer.zMax); // Deep background Z range

        // Fast speeds moving leftwards (negative X), downwards (negative Y)
        layer.velocities[index * 3] = (-150 - Math.random() * 100) * layer.speedMult;     // X velocity
        layer.velocities[index * 3 + 1] = (-50 - Math.random() * 50) * layer.speedMult;   // Y velocity
        layer.velocities[index * 3 + 2] = 0;                          // Z velocity

        this.updateInstance(layer, index);
    }

    updateInstance(layer: MeteorLayer, index: number) {
        this.dummy.position.set(
            layer.positions[index * 3],
            layer.positions[index * 3 + 1],
            layer.positions[index * 3 + 2]
        );

        // Orient the meteor to face its velocity
        const vx = layer.velocities[index * 3];
        const vy = layer.velocities[index * 3 + 1];
        const vz = layer.velocities[index * 3 + 2];

        const target = new THREE.Vector3(
            this.dummy.position.x + vx,
            this.dummy.position.y + vy,
            this.dummy.position.z + vz
        );
        this.dummy.lookAt(target);

        this.dummy.updateMatrix();
        layer.mesh.setMatrixAt(index, this.dummy.matrix);
    }

    activate() {
        if (this.active) return;
        this.active = true;
        for (const layer of this.layers) {
            layer.mesh.visible = true;
        }
    }

    deactivate() {
        if (!this.active) return;
        this.active = false;
        for (const layer of this.layers) {
            layer.mesh.visible = false;
        }
    }

    update(delta: number, cameraX: number, playerPos?: THREE.Vector3) {
        if (!this.active) return;
        if (playerPos) {
            this.uPlayerPos.value.copy(playerPos);
        }

        for (const layer of this.layers) {
            for (let i = 0; i < layer.count; i++) {
                layer.positions[i * 3] += layer.velocities[i * 3] * delta;
                layer.positions[i * 3 + 1] += layer.velocities[i * 3 + 1] * delta;

                // If it falls behind camera or too low, reset
                if (layer.positions[i * 3] < cameraX - 100 || layer.positions[i * 3 + 1] < -100) {
                    this.resetMeteor(layer, i, cameraX);
                } else {
                    this.updateInstance(layer, i);
                }
            }
            layer.mesh.instanceMatrix.needsUpdate = true;
        }
    }

    hitMeteor(worldPosition: THREE.Vector3, particleSystem: any, cameraPos: THREE.Vector3, shotDirection: THREE.Vector3 = new THREE.Vector3(1, 0, 0)): boolean {
        if (!this.active) return false;

        let hitFound = false;
        const rayDir = new THREE.Vector3().subVectors(worldPosition, cameraPos).normalize();

        for (const layer of this.layers) {
            for (let i = 0; i < layer.count; i++) {
                const idx = i * 3;
                const mx = layer.positions[idx];
                const my = layer.positions[idx+1];
                const mz = layer.positions[idx+2];

                // Scale checking - if it's currently exploding/invisible we shouldn't hit it again
                // For now meteors don't have scale array so we assume they are active. We'll use a hack to move them offscreen when hit.
                if (mx < cameraPos.x - 100) continue;

                if (Math.abs(rayDir.z) < 0.001) continue;
                const t = (mz - cameraPos.z) / rayDir.z;
                if (t < 0) continue;

                const projectedX = cameraPos.x + t * rayDir.x;
                const projectedY = cameraPos.y + t * rayDir.y;

                const distSq = (projectedX - mx) * (projectedX - mx) + (projectedY - my) * (projectedY - my);

                // Meteors are long but thin. Approximate hit radius based on scale.
                // 0.5 is base width, scale adjusts it.
                const hitRadius = layer.scale * 2.0;

                if (distSq < hitRadius * hitRadius) {
                    hitFound = true;

                    // Explode
                    if (particleSystem) {
                        particleSystem.emit(new THREE.Vector3(mx, my, mz), 0xffaa00, 10, 4.0, layer.scale);
                        particleSystem.emit(new THREE.Vector3(mx, my, mz), 0xffffff, 5, 2.0, layer.scale * 0.5);
                    }

                    // Move offscreen to simulate destruction (it will reset normally)
                    layer.positions[idx] = cameraPos.x - 200;
                    this.updateInstance(layer, i);
                    layer.mesh.instanceMatrix.needsUpdate = true;
                    return true; // Single hit
                }
            }
        }
        return hitFound;
    }

    cleanup() {
        for (const layer of this.layers) {
            this.scene.remove(layer.mesh);
            layer.mesh.geometry.dispose();
            if (layer.mesh.material && (layer.mesh.material as any).dispose) {
                (layer.mesh.material as any).dispose();
            }
        }
    }
}
