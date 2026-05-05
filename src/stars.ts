import * as THREE from 'three';
import { color, vec3, vec4, time, positionLocal, attribute, uniform, mix, sin, cos, smoothstep } from 'three/tsl';
import { PointsNodeMaterial } from 'three/webgpu';

// ============================================================================
// Magical Starfield System for Dog Dash
// A dreamy, multi-layer parallax starfield with pastel colors and shooting stars
// ============================================================================

// Global uniforms for external control (preserved for backward compatibility)
export const uStarPulse = uniform(0.0); // 0 to 1 - for warp/boost effects
export const uStarColor = uniform(color(0xFFFFFF)); // Current pulse color
export const uStarOpacity = uniform(0.0); // Opacity control

// Pastel color palette for magical effect
const PASTEL_COLORS = [
    new THREE.Color(0xFFB6C1), // Light Pink
    new THREE.Color(0xE6E6FA), // Lavender
    new THREE.Color(0x98FF98), // Mint Green
    new THREE.Color(0xFFFACD), // Lemon Chiffon (soft gold)
    new THREE.Color(0xB0E0E6), // Powder Blue
    new THREE.Color(0xFFDAB9), // Peach Puff
    new THREE.Color(0xDDA0DD), // Plum
    new THREE.Color(0xF0E68C), // Khaki (soft yellow)
    new THREE.Color(0xFFE4E1), // Misty Rose
];

// Heart shape for special stars (simple 2D heart)
const HEART_SHAPE = new Float32Array([
    0, 0.5, 0,
    -0.5, 0.8, 0, -0.3, 0.5, 0, -0.5, 0.2, 0,
    0, -0.3, 0,
    0.5, 0.2, 0, 0.3, 0.5, 0, 0.5, 0.8, 0,
]);

interface StarLayerConfig {
    count: number;
    minSize: number;
    maxSize: number;
    speed: number;
    zRange: [number, number];
    twinkleSpeed: number;
    opacity: number;
    heartRatio: number; // Ratio of hearts vs regular stars
}

interface ShootingStar {
    mesh: THREE.Line;
    startPos: THREE.Vector3;
    endPos: THREE.Vector3;
    progress: number;
    speed: number;
    active: boolean;
    trailPositions: Float32Array;
    color: THREE.Color;
}

// Layer configurations for parallax effect
const LAYER_CONFIGS: StarLayerConfig[] = [
    { // Background layer - large, dim, slow
        count: 150,
        minSize: 3.0,
        maxSize: 6.0,
        speed: 5,
        zRange: [-80, -60],
        twinkleSpeed: 0.3,
        opacity: 0.4,
        heartRatio: 0.1
    },
    { // Mid layer - medium stars
        count: 400,
        minSize: 1.5,
        maxSize: 3.5,
        speed: 15,
        zRange: [-60, -40],
        twinkleSpeed: 0.8,
        opacity: 0.7,
        heartRatio: 0.15
    },
    { // Foreground layer - small, bright, fast
        count: 600,
        minSize: 0.8,
        maxSize: 2.0,
        speed: 35,
        zRange: [-40, -20],
        twinkleSpeed: 1.5,
        opacity: 0.9,
        heartRatio: 0.2
    },
    { // Very close layer - tiny, very fast
        count: 300,
        minSize: 0.4,
        maxSize: 1.2,
        speed: 60,
        zRange: [-20, -5],
        twinkleSpeed: 2.0,
        opacity: 1.0,
        heartRatio: 0.25
    }
];

export class StarfieldSystem {
    private scene: THREE.Scene;
    private layers: THREE.Points[] = [];
    private layerConfigs: StarLayerConfig[] = [];
    private layerData: Array<{
        positions: Float32Array;
        velocities: Float32Array;
        colors: Float32Array;
        sizes: Float32Array;
        offsets: Float32Array;
        isHearts: boolean[];
    }> = [];
    
    // Shooting stars
    private shootingStars: ShootingStar[] = [];
    private shootingStarPool: THREE.Line[] = [];
    private maxShootingStars = 5;
    private shootingStarTimer = 0;
    private shootingStarInterval = 3; // Spawn check every 3 seconds
    
    // Bounds for wrapping
    private bounds = { x: 80, y: 50 };
    
    // Speed multiplier from game
    private currentSpeedMultiplier = 1.0;
    
    // Collectible callback
    public onCollectibleDrop?: (position: THREE.Vector3) => void;

    constructor(scene: THREE.Scene) {
        this.scene = scene;
        this.initLayers();
        this.initShootingStarPool();
    }

    private initLayers() {
        LAYER_CONFIGS.forEach((config, layerIndex) => {
            const geometry = new THREE.BufferGeometry();
            const positions = new Float32Array(config.count * 3);
            const velocities = new Float32Array(config.count);
            const colors = new Float32Array(config.count * 3);
            const sizes = new Float32Array(config.count);
            const offsets = new Float32Array(config.count);
            const isHearts: boolean[] = [];

            for (let i = 0; i < config.count; i++) {
                // Random position within bounds
                positions[i * 3] = (Math.random() - 0.5) * this.bounds.x * 3;
                positions[i * 3 + 1] = (Math.random() - 0.5) * this.bounds.y * 2;
                positions[i * 3 + 2] = config.zRange[0] + Math.random() * (config.zRange[1] - config.zRange[0]);

                // Individual velocity variation
                velocities[i] = config.speed * (0.8 + Math.random() * 0.4);

                // Pastel color selection
                const colorIdx = Math.floor(Math.random() * PASTEL_COLORS.length);
                const pastelColor = PASTEL_COLORS[colorIdx];
                colors[i * 3] = pastelColor.r;
                colors[i * 3 + 1] = pastelColor.g;
                colors[i * 3 + 2] = pastelColor.b;

                // Size with variation
                sizes[i] = config.minSize + Math.random() * (config.maxSize - config.minSize);

                // Twinkle offset
                offsets[i] = Math.random() * Math.PI * 2;

                // Heart shape flag
                isHearts.push(Math.random() < config.heartRatio);
            }

            geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
            geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
            geometry.setAttribute('offset', new THREE.BufferAttribute(offsets, 1));

            // Create material with custom nodes for twinkling
            const material = new PointsNodeMaterial({
                size: 1.0,
                vertexColors: true,
                transparent: true,
                opacity: config.opacity,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                fog: false
            });

            // Create twinkle effect using TSL
            const aOffset = attribute('offset', 'float');
            const aSize = attribute('size', 'float');
            
            // Twinkle calculation: sine wave based on time + individual offset
            const twinkle = sin(time.mul(config.twinkleSpeed).add(aOffset)).mul(0.5).add(0.5);
            
            // Add star pulse influence (from boost/warp)
            const intensity = twinkle.add(uStarPulse.mul(0.5));
            
            // Color mixing with pulse color
            const finalRGB = mix(
                attribute('color', 'vec3'), 
                uStarColor.rgb, 
                uStarPulse.mul(0.5)
            );

            // Apply opacity uniform
            material.colorNode = vec4(finalRGB, uStarOpacity.mul(intensity.max(0.3)));
            
            // Size variation with twinkle
            material.sizeNode = aSize.mul(intensity.mul(0.5).add(0.5));

            const points = new THREE.Points(geometry, material);
            points.userData = { 
                isStarLayer: true, 
                layerIndex,
                baseSpeed: config.speed 
            };
            
            this.scene.add(points);
            this.layers.push(points);
            this.layerConfigs.push(config);
            this.layerData.push({ positions, velocities, colors, sizes, offsets, isHearts });
        });
    }

    private initShootingStarPool() {
        const trailLength = 20;
        
        for (let i = 0; i < this.maxShootingStars; i++) {
            const geometry = new THREE.BufferGeometry();
            const positions = new Float32Array(trailLength * 3);
            
            // Initialize all points at origin
            for (let j = 0; j < trailLength * 3; j++) {
                positions[j] = 0;
            }
            
            geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            
            // Create gradient material for trail
            const material = new THREE.LineBasicMaterial({
                color: 0xFFFFFF,
                transparent: true,
                opacity: 0,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            });
            
            const line = new THREE.Line(geometry, material);
            line.visible = false;
            this.scene.add(line);
            
            this.shootingStarPool.push(line);
            
            // Initialize shooting star data
            this.shootingStars.push({
                mesh: line,
                startPos: new THREE.Vector3(),
                endPos: new THREE.Vector3(),
                progress: 0,
                speed: 0,
                active: false,
                trailPositions: positions,
                color: new THREE.Color()
            });
        }
    }

    public addShootingStar() {
        // Find inactive shooting star
        const shootingStar = this.shootingStars.find(s => !s.active);
        if (!shootingStar) return;

        // Random start position (from top-right going down-left, or top going down)
        const startX = 30 + Math.random() * 20;
        const startY = 20 + Math.random() * 15;
        const startZ = -30 - Math.random() * 30;
        
        shootingStar.startPos.set(startX, startY, startZ);
        
        // End position (diagonal downward)
        const angle = Math.PI * 0.75 + (Math.random() - 0.5) * 0.5; // Mostly down-left
        const distance = 40 + Math.random() * 30;
        shootingStar.endPos.set(
            startX + Math.cos(angle) * distance,
            startY - distance * 0.6, // Downward
            startZ + (Math.random() - 0.5) * 10
        );
        
        shootingStar.progress = 0;
        shootingStar.speed = 25 + Math.random() * 20;
        shootingStar.active = true;
        
        // Random pastel color for trail
        const colorIdx = Math.floor(Math.random() * PASTEL_COLORS.length);
        shootingStar.color.copy(PASTEL_COLORS[colorIdx]);
        
        // Update material
        const material = shootingStar.mesh.material as THREE.LineBasicMaterial;
        material.color.copy(shootingStar.color);
        material.opacity = 1;
        
        shootingStar.mesh.visible = true;
    }

    private updateShootingStars(deltaTime: number) {
        this.shootingStars.forEach(star => {
            if (!star.active) return;

            // Update progress
            star.progress += star.speed * deltaTime * 0.5;
            
            if (star.progress >= 1) {
                // Shooting star finished - maybe drop collectible
                if (Math.random() < 0.3 && this.onCollectibleDrop) {
                    const dropPos = star.endPos.clone();
                    dropPos.z = 0; // Move to playable plane
                    this.onCollectibleDrop(dropPos);
                }
                
                star.active = false;
                star.mesh.visible = false;
                return;
            }

            // Calculate current position
            const currentPos = new THREE.Vector3().lerpVectors(
                star.startPos,
                star.endPos,
                star.progress
            );

            // Update trail positions (shift array and add new position)
            const positions = star.trailPositions;
            const trailLength = positions.length / 3;
            
            // Shift all positions back
            for (let i = trailLength - 1; i > 0; i--) {
                positions[i * 3] = positions[(i - 1) * 3];
                positions[i * 3 + 1] = positions[(i - 1) * 3 + 1];
                positions[i * 3 + 2] = positions[(i - 1) * 3 + 2];
            }
            
            // Add new head position
            positions[0] = currentPos.x;
            positions[1] = currentPos.y;
            positions[2] = currentPos.z;

            // Update geometry
            star.mesh.geometry.attributes.position.needsUpdate = true;
            
            // Fade out near end
            const material = star.mesh.material as THREE.LineBasicMaterial;
            if (star.progress > 0.7) {
                material.opacity = 1 - (star.progress - 0.7) / 0.3;
            }
        });
    }

    private updateLayers(deltaTime: number, speedMultiplier: number) {
        this.currentSpeedMultiplier = speedMultiplier;
        
        this.layers.forEach((layer, layerIdx) => {
            const positions = this.layerData[layerIdx].positions;
            const velocities = this.layerData[layerIdx].velocities;
            const config = this.layerConfigs[layerIdx];
            
            // Calculate effective speed (base + game speed influence)
            // Foreground layers move faster with game speed
            const speedFactor = 1 + (layerIdx * 0.5); // Higher layers more affected by boost
            const effectiveSpeed = speedMultiplier * speedFactor;
            
            for (let i = 0; i < config.count; i++) {
                // Move star leftward (negative X)
                const moveSpeed = velocities[i] * (1 + effectiveSpeed * 0.5);
                positions[i * 3] -= moveSpeed * deltaTime;
                
                // Wrap around when off screen
                if (positions[i * 3] < -this.bounds.x * 1.5) {
                    positions[i * 3] = this.bounds.x * 1.5;
                    positions[i * 3 + 1] = (Math.random() - 0.5) * this.bounds.y * 2;
                    
                    // Maybe change color on respawn
                    if (Math.random() < 0.3) {
                        const colorIdx = Math.floor(Math.random() * PASTEL_COLORS.length);
                        const pastelColor = PASTEL_COLORS[colorIdx];
                        const colors = this.layerData[layerIdx].colors;
                        colors[i * 3] = pastelColor.r;
                        colors[i * 3 + 1] = pastelColor.g;
                        colors[i * 3 + 2] = pastelColor.b;
                    }
                }
            }
            
            layer.geometry.attributes.position.needsUpdate = true;
            if (layer.geometry.attributes.color) {
                layer.geometry.attributes.color.needsUpdate = true;
            }
        });
    }

    public update(deltaTime: number, speedMultiplier: number = 1.0) {
        // Clamp deltaTime to avoid jumps
        const dt = Math.min(deltaTime, 0.1);
        
        // Update parallax layers
        this.updateLayers(dt, speedMultiplier);
        
        // Update shooting stars
        this.updateShootingStars(dt);
        
        // Check for new shooting star spawn
        this.shootingStarTimer += dt;
        if (this.shootingStarTimer >= this.shootingStarInterval) {
            this.shootingStarTimer = 0;
            // Random chance to spawn
            if (Math.random() < 0.4) {
                this.addShootingStar();
            }
        }
    }

    // Cleanup method
    public dispose() {
        this.layers.forEach(layer => {
            this.scene.remove(layer);
            layer.geometry.dispose();
            (layer.material as THREE.Material).dispose();
        });
        this.layers = [];
        
        this.shootingStarPool.forEach(star => {
            this.scene.remove(star);
            star.geometry.dispose();
            (star.material as THREE.Material).dispose();
        });
        this.shootingStarPool = [];
    }
}

// ============================================================================
// Backward Compatibility: Original createStars function
// ============================================================================

export function createStars(count: number = 2000): THREE.Points {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const offsets = new Float32Array(count);

    const radius = 400;

    for (let i = 0; i < count; i++) {
        const u = Math.random();
        const v = Math.random();
        const theta = 2 * Math.PI * u;
        const phi = Math.acos(2 * v - 1);

        const r = radius * (0.9 + Math.random() * 0.2);
        const x = r * Math.sin(phi) * Math.cos(theta);
        const y = r * Math.sin(phi) * Math.sin(theta);
        const z = r * Math.cos(phi);

        positions[i * 3] = x;
        positions[i * 3 + 1] = Math.abs(y); // Keep mostly above horizon
        positions[i * 3 + 2] = z;

        sizes[i] = Math.random() * 1.5 + 0.5;
        offsets[i] = Math.random() * 100;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute('offset', new THREE.BufferAttribute(offsets, 1));

    const mat = new PointsNodeMaterial({
        size: 1.0,
        transparent: true,
        opacity: 1.0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false
    });

    const aOffset = attribute('offset', 'float');
    const aSize = attribute('size', 'float');

    // Twinkle effect
    const twinkle = time.add(aOffset).sin().mul(0.5).add(0.5);
    const intensity = twinkle.add(uStarPulse);

    // Color mixing
    const finalRGB = mix(color(0xFFFFFF), uStarColor, uStarPulse.mul(0.8));

    // Combine RGB with the Opacity Uniform into a vec4
    mat.colorNode = vec4(finalRGB, uStarOpacity).mul(mat.color as unknown as any);

    mat.sizeNode = aSize.mul(intensity.max(0.2));

    // Star Warp / Rotation Logic
    const pos = positionLocal;
    const warpFactor = uStarPulse.mul(50.0);
    const warpedPos = pos.add(pos.normalize().mul(warpFactor));

    const angle = time.mul(0.1);
    const rotatedX = warpedPos.x.mul(cos(angle)).sub(warpedPos.z.mul(sin(angle)));
    const rotatedZ = warpedPos.x.mul(sin(angle)).add(warpedPos.z.mul(cos(angle)));

    mat.positionNode = vec3(rotatedX, warpedPos.y, rotatedZ);

    const stars = new THREE.Points(geo, mat);
    stars.userData.isStars = true;

    return stars;
}
