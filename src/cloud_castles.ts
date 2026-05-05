/**
 * Cloud Castles - Dreamy floating castle background for Dog Dash
 * A magical fairy-tale world in the clouds for a 7-year-old girl
 * ☁️🏰✨🌈
 */

import * as THREE from 'three';
import {
    MeshStandardNodeMaterial,
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
    dot,
    fract,
    length,
    pow,
    positionLocal,
    positionWorld
} from 'three/tsl';

// --- Dreamy Pastel Colors ---
const PASTEL_COLORS = {
    cottonCandy: 0xFFB6E6,    // Pink
    lavender: 0xE6B6FF,       // Purple
    mint: 0xB6FFE6,           // Mint green
    sky: 0xB6E6FF,            // Sky blue
    peach: 0xFFE6B6,          // Peach
    cream: 0xFFFEF0,          // Creamy white
    gold: 0xFFE4B5,           // Soft gold
    rose: 0xFFB6C1            // Light rose
};

const TOWER_COLORS = [
    0xFFF0F5,  // Lavender blush
    0xF0FFF0,  // Honeydew
    0xFFF5EE,  // Seashell
    0xF5FFFA,  // Mint cream
    0xFFE4E1,  // Misty rose
    0xE6E6FA,  // Lavender
];

const RAINBOW_COLORS = [
    0xFF6B6B,  // Red
    0xFFB347,  // Orange
    0xFFEB3B,  // Yellow
    0x77DD77,  // Green
    0x6BB5FF,  // Blue
    0x9B59B6,  // Purple
    0xFF69B4,  // Pink
];

// --- TSL Noise Helpers ---

const random2D = (v: any) => {
    return sin(dot(v, vec2(12.9898, 78.233))).mul(43758.5453).fract();
};

const valueNoise = (v: any) => {
    const i = v.floor();
    const f = v.fract();
    const a = random2D(i);
    const b = random2D(i.add(vec2(1.0, 0.0)));
    const c = random2D(i.add(vec2(0.0, 1.0)));
    const d = random2D(i.add(vec2(1.0, 1.0)));
    const u = f.mul(f).mul(float(3.0).sub(f.mul(2.0)));
    return mix(a, b, u.x).add(
        (c.sub(a).mul(u.y).mul(float(1.0).sub(u.x))).add(
        (d.sub(b).mul(u.x).mul(u.y)))
    );
};

const fbm = (v: any) => {
    let total = float(0.0);
    let amplitude = float(0.5);
    let frequency = float(1.0);
    total = total.add(valueNoise(v.mul(frequency)).mul(amplitude));
    frequency = frequency.mul(2.0);
    amplitude = amplitude.mul(0.5);
    total = total.add(valueNoise(v.mul(frequency)).mul(amplitude));
    frequency = frequency.mul(2.0);
    amplitude = amplitude.mul(0.5);
    total = total.add(valueNoise(v.mul(frequency)).mul(amplitude));
    return total;
};

// --- Cloud Material with Soft Edges ---

function createDreamyCloudMaterial(baseColorHex: number, opacity: number = 0.9) {
    const mat = new MeshStandardNodeMaterial({
        transparent: true,
        opacity: opacity,
        side: THREE.DoubleSide,
        depthWrite: false,
        roughness: 0.9,
        metalness: 0.0
    });

    const uTime = time;
    const vUv = uv();
    const baseColor = color(new THREE.Color(baseColorHex));

    // Create soft, fluffy noise
    const p = vUv.mul(4.0);
    const t = uTime.mul(0.1);
    const noiseVal = fbm(p.add(vec2(t, t.mul(0.5))));

    // Soft edge falloff using sphere normals
    const normal = positionLocal.normalize();
    const fresnel = float(1.0).sub(normal.z.abs());
    const softEdge = smoothstep(0.2, 0.8, fresnel);

    // Combine for fluffy look
    const density = noiseVal.mul(softEdge);
    const alpha = smoothstep(0.1, 0.5, density).mul(opacity);

    // Soft internal shadows
    const shadowFactor = noiseVal.mul(0.3).add(0.7);
    const finalColor = baseColor.mul(shadowFactor);

    // Gentle glow pulse
    const glow = sin(uTime.mul(0.5)).add(1.0).mul(0.1).add(0.9);

    mat.colorNode = vec4(finalColor.mul(glow), alpha);

    return mat;
}

// --- Tower Material with Soft Shading ---

function createTowerMaterial(colorHex: number) {
    const mat = new MeshStandardNodeMaterial({
        color: colorHex,
        roughness: 0.6,
        metalness: 0.1
    });

    const uTime = time;
    const vUv = uv();

    // Subtle magic shimmer
    const shimmer = sin(uTime.mul(2.0).add(vUv.x.mul(10.0)).add(vUv.y.mul(5.0)))
        .add(1.0).mul(0.5).mul(0.1);

    const baseColor = color(new THREE.Color(colorHex));
    const shimmerColor = color(new THREE.Color(0xFFFFFF));

    mat.emissiveNode = shimmerColor.mul(shimmer);

    return mat;
}

// --- Window Glow Material ---

function createWindowGlowMaterial() {
    const mat = new MeshBasicNodeMaterial({
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide
    });

    const uTime = time;
    
    // Warm yellow glow with twinkle
    const twinkle = sin(uTime.mul(3.0)).add(1.0).mul(0.5).mul(0.3).add(0.7);
    const warmColor = color(new THREE.Color(0xFFE4B5)).mul(twinkle);

    // Soft circular shape
    const vUv = uv();
    const centered = vUv.sub(0.5);
    const dist = length(centered).mul(2.0);
    const alpha = smoothstep(1.0, 0.3, dist);

    mat.colorNode = vec4(warmColor, alpha);

    return mat;
}

// --- Rainbow Bridge Material ---

function createRainbowMaterial() {
    const mat = new MeshBasicNodeMaterial({
        transparent: true,
        opacity: 0.7,
        side: THREE.DoubleSide,
        depthWrite: false
    });

    const uTime = time;
    const vUv = uv();

    // Rainbow gradient along U coordinate with shimmer
    const hue = vUv.x.add(sin(uTime.mul(0.5)).mul(0.1));
    
    // Create rainbow bands
    let rainbow = vec3(0.0, 0.0, 0.0);
    const bands = float(7.0);
    const bandIndex = hue.mul(bands).fract();
    
    // Simple rainbow coloring
    const r = sin(hue.mul(Math.PI * 2.0)).mul(0.5).add(0.5);
    const g = sin(hue.mul(Math.PI * 2.0).add(2.0)).mul(0.5).add(0.5);
    const b = sin(hue.mul(Math.PI * 2.0).add(4.0)).mul(0.5).add(0.5);
    
    rainbow = vec3(r, g, b).mul(0.8).add(0.2);

    // Sparkle effect
    const sparkleNoise = fbm(vUv.mul(20.0).add(uTime));
    const sparkle = smoothstep(0.7, 0.9, sparkleNoise).mul(0.5);

    const finalColor = rainbow.add(vec3(sparkle));
    const alpha = float(0.6).add(sparkle.mul(0.3));

    mat.colorNode = vec4(finalColor, alpha);

    return mat;
}

// --- Heart Flag Material ---

function createHeartFlagMaterial(colorHex: number) {
    const mat = new MeshBasicNodeMaterial({
        transparent: true,
        side: THREE.DoubleSide
    });

    const uTime = time;
    const vUv = uv();

    // Heart shape SDF
    const centered = vUv.sub(0.5);
    const x = centered.x;
    const y = centered.y;
    
    // Heart formula
    const a = x.mul(x).add(y.mul(y)).sub(0.25);
    const heartDist = a.mul(a).mul(a).sub(x.mul(x).mul(y.mul(y).mul(y)));
    
    // Heart mask
    const heartMask = smoothstep(0.001, 0.0, heartDist.mul(100.0));

    // Gentle wave animation
    const wave = sin(uTime.mul(2.0).add(vUv.x.mul(5.0))).mul(0.1);
    const waveMask = smoothstep(0.4, 0.5, vUv.y.add(wave));

    const baseColor = color(new THREE.Color(colorHex));
    const alpha = heartMask.mul(waveMask);

    mat.colorNode = vec4(baseColor, alpha);
    mat.alphaTest = 0.1;

    return mat;
}

// --- Glowing Flower Material ---

function createGlowFlowerMaterial(colorHex: number) {
    const mat = new MeshStandardNodeMaterial({
        color: colorHex,
        emissive: colorHex,
        emissiveIntensity: 0.5,
        roughness: 0.8
    });

    const uTime = time;
    
    // Gentle pulse
    const pulse = sin(uTime.mul(1.5)).add(1.0).mul(0.5).mul(0.3).add(0.7);
    mat.emissiveIntensity = 0.5 * pulse.value;

    return mat;
}

// --- Shooting Star System ---

class ShootingStarSystem {
    stars: Array<{
        mesh: THREE.Mesh;
        velocity: THREE.Vector3;
        active: boolean;
        life: number;
    }> = [];
    maxStars: number = 5;

    constructor(scene: THREE.Scene) {
        const geometry = new THREE.PlaneGeometry(2, 0.1);
        const material = new THREE.MeshBasicMaterial({
            color: 0xFFFFFF,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending
        });

        for (let i = 0; i < this.maxStars; i++) {
            const mesh = new THREE.Mesh(geometry, material.clone());
            mesh.visible = false;
            scene.add(mesh);
            
            this.stars.push({
                mesh,
                velocity: new THREE.Vector3(),
                active: false,
                life: 0
            });
        }
    }

    spawn(x: number, y: number, z: number) {
        const star = this.stars.find(s => !s.active);
        if (!star) return;

        star.active = true;
        star.life = 2 + Math.random() * 2;
        star.mesh.position.set(x, y, z);
        star.mesh.visible = true;
        
        // Random direction across the sky
        const angle = Math.PI * 0.25 + Math.random() * Math.PI * 0.5;
        const speed = 20 + Math.random() * 30;
        star.velocity.set(
            Math.cos(angle) * speed,
            -Math.sin(angle * 0.3) * speed * 0.3,
            0
        );

        // Orient mesh to velocity
        star.mesh.rotation.z = Math.atan2(star.velocity.y, star.velocity.x);
    }

    update(dt: number, cameraX: number) {
        // Random spawn
        if (Math.random() < 0.005) {
            this.spawn(
                cameraX + 50 + Math.random() * 30,
                10 + Math.random() * 20,
                -40 - Math.random() * 20
            );
        }

        this.stars.forEach(star => {
            if (!star.active) return;

            star.life -= dt;
            
            if (star.life <= 0) {
                star.active = false;
                star.mesh.visible = false;
                return;
            }

            // Move
            star.mesh.position.addScaledVector(star.velocity, dt);
            
            // Fade out
            const material = star.mesh.material as THREE.MeshBasicMaterial;
            material.opacity = Math.min(1, star.life) * 0.8;
            
            // Stretch based on speed
            const stretch = 1 + star.velocity.length() * 0.02;
            star.mesh.scale.x = stretch;
        });
    }
}

// --- Individual Cloud Castle Class ---

export class CloudCastle {
    group: THREE.Group;
    cloudBase: THREE.Mesh;
    towers: THREE.Mesh[] = [];
    bridges: THREE.Mesh[] = [];
    decorations: THREE.Object3D[] = [];
    glowLights: THREE.PointLight[] = [];
    windows: THREE.Mesh[] = [];
    flowers: THREE.Mesh[] = [];
    
    // Animation state
    private baseY: number;
    private floatOffset: number;
    private floatSpeed: number;
    private floatAmplitude: number;
    private windowTwinkleTimer: number = 0;
    private scale: number;

    constructor(position: THREE.Vector3, scale: number = 1) {
        this.group = new THREE.Group();
        this.scale = scale;
        this.group.position.copy(position);
        this.group.scale.setScalar(scale);

        this.baseY = position.y;
        this.floatOffset = Math.random() * Math.PI * 2;
        this.floatSpeed = 0.5 + Math.random() * 0.5;
        this.floatAmplitude = 0.3 + Math.random() * 0.4;

        this.createCloudPlatform();
        this.createTowers();
        this.createBridges();
        this.createDecorations();
        this.createGlowLights();
    }

    private createCloudPlatform() {
        // Main fluffy cloud base made of merged spheres
        const cloudGroup = new THREE.Group();
        
        const pastelColors = [
            PASTEL_COLORS.cottonCandy,
            PASTEL_COLORS.lavender,
            PASTEL_COLORS.mint,
            PASTEL_COLORS.cream
        ];
        const mainColor = pastelColors[Math.floor(Math.random() * pastelColors.length)];
        
        const material = createDreamyCloudMaterial(mainColor, 0.85);

        // Create billowy shape with multiple spheres
        const puffCount = 5 + Math.floor(Math.random() * 4);
        for (let i = 0; i < puffCount; i++) {
            const radius = 1.5 + Math.random() * 1.5;
            const geometry = new THREE.SphereGeometry(radius, 16, 16);
            const puff = new THREE.Mesh(geometry, material);

            // Position in a cluster
            const angle = (i / puffCount) * Math.PI * 2 + Math.random() * 0.5;
            const distance = Math.random() * 1.5;
            puff.position.set(
                Math.cos(angle) * distance,
                (Math.random() - 0.5) * 0.8,
                Math.sin(angle) * distance
            );

            // Vary the scale for organic look
            const s = 0.8 + Math.random() * 0.4;
            puff.scale.set(s, s * 0.8, s);

            cloudGroup.add(puff);
        }

        // Add a flat top for the castle
        const topGeometry = new THREE.CylinderGeometry(2.5, 3, 1, 16);
        const top = new THREE.Mesh(topGeometry, material);
        top.position.y = 0.3;
        cloudGroup.add(top);

        this.cloudBase = cloudGroup as any;
        this.group.add(cloudGroup);
    }

    private createTowers() {
        const towerCount = 2 + Math.floor(Math.random() * 3);

        for (let i = 0; i < towerCount; i++) {
            const angle = (i / towerCount) * Math.PI * 2 + Math.random() * 0.5;
            const distance = 1 + Math.random() * 1.2;
            const height = 2 + Math.random() * 2;

            const towerGroup = new THREE.Group();
            towerGroup.position.set(
                Math.cos(angle) * distance,
                1,
                Math.sin(angle) * distance
            );

            // Tower color
            const towerColor = TOWER_COLORS[Math.floor(Math.random() * TOWER_COLORS.length)];
            const material = createTowerMaterial(towerColor);

            // Main tower body (rounded)
            const bodyGeo = new THREE.CylinderGeometry(0.4, 0.6, height, 12);
            const body = new THREE.Mesh(bodyGeo, material);
            body.position.y = height / 2;
            body.castShadow = true;
            towerGroup.add(body);

            // Rounded turret top
            const turretGeo = new THREE.SphereGeometry(0.5, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2);
            const turret = new THREE.Mesh(turretGeo, material);
            turret.position.y = height;
            towerGroup.add(turret);

            // Glowing windows
            const windowCount = 2 + Math.floor(Math.random() * 2);
            for (let w = 0; w < windowCount; w++) {
                const windowY = height * 0.3 + (w * height * 0.25);
                this.createWindow(towerGroup, windowY, 0.5);
            }

            // Heart flag on top
            this.createHeartFlag(towerGroup, height + 0.5);

            this.towers.push(body);
            this.group.add(towerGroup);
        }
    }

    private createWindow(parent: THREE.Group, y: number, x: number) {
        const windowGeo = new THREE.CircleGeometry(0.15, 8);
        const material = createWindowGlowMaterial();
        const window = new THREE.Mesh(windowGeo, material);
        window.position.set(x, y, 0.55);
        parent.add(window);
        this.windows.push(window);
    }

    private createHeartFlag(parent: THREE.Group, y: number) {
        const flagGroup = new THREE.Group();
        flagGroup.position.y = y;

        // Flag pole
        const poleGeo = new THREE.CylinderGeometry(0.02, 0.02, 1, 6);
        const poleMat = new THREE.MeshStandardMaterial({ color: 0xFFD700 });
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.y = 0.5;
        flagGroup.add(pole);

        // Heart flag
        const heartGeo = new THREE.PlaneGeometry(0.4, 0.4);
        const heartColor = RAINBOW_COLORS[Math.floor(Math.random() * RAINBOW_COLORS.length)];
        const heartMat = createHeartFlagMaterial(heartColor);
        const heart = new THREE.Mesh(heartGeo, heartMat);
        heart.position.set(0.2, 0.9, 0);
        flagGroup.add(heart);

        // Animate flag
        flagGroup.userData.animationType = 'flagWave';
        flagGroup.userData.animationOffset = Math.random() * 10;

        parent.add(flagGroup);
        this.decorations.push(flagGroup);
    }

    private createBridges() {
        // Only create bridges if we have multiple towers
        if (this.towers.length < 2) return;

        // Create 1-2 rainbow bridges
        const bridgeCount = Math.min(2, this.towers.length - 1);

        for (let i = 0; i < bridgeCount; i++) {
            const bridgeGroup = new THREE.Group();

            // Arched bridge
            const curve = new THREE.QuadraticBezierCurve3(
                new THREE.Vector3(-1.5, 1.5, 0),
                new THREE.Vector3(0, 3, 0),
                new THREE.Vector3(1.5, 1.5, 0)
            );

            const tubeGeo = new THREE.TubeGeometry(curve, 12, 0.15, 8, false);
            const material = createRainbowMaterial();
            const bridge = new THREE.Mesh(tubeGeo, material);

            bridgeGroup.add(bridge);

            // Sparkle particles along bridge
            this.createBridgeSparkles(bridgeGroup, curve);

            // Position bridge between towers
            const angle = Math.random() * Math.PI * 2;
            bridgeGroup.position.set(
                Math.cos(angle) * 0.5,
                2,
                Math.sin(angle) * 0.5
            );
            bridgeGroup.rotation.y = Math.random() * Math.PI;

            this.bridges.push(bridge);
            this.group.add(bridgeGroup);
        }
    }

    private createBridgeSparkles(parent: THREE.Group, curve: THREE.QuadraticBezierCurve3) {
        const sparkleCount = 8;
        const sparkleGeo = new THREE.PlaneGeometry(0.1, 0.1);
        const sparkleMat = new THREE.MeshBasicMaterial({
            color: 0xFFFFFF,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending
        });

        for (let i = 0; i < sparkleCount; i++) {
            const t = i / (sparkleCount - 1);
            const point = curve.getPoint(t);
            
            const sparkle = new THREE.Mesh(sparkleGeo, sparkleMat.clone());
            sparkle.position.copy(point);
            sparkle.position.x += (Math.random() - 0.5) * 0.3;
            sparkle.position.z += (Math.random() - 0.5) * 0.3;
            
            sparkle.userData = {
                animationType: 'sparkle',
                animationOffset: Math.random() * 10,
                basePos: point.clone()
            };

            parent.add(sparkle);
            this.decorations.push(sparkle);
        }
    }

    private createDecorations() {
        // Floating sleeping creature silhouettes
        this.createSleepingWindows();

        // Glowing flower gardens
        this.createFlowerGardens();

        // Tiny bells
        this.createBells();
    }

    private createSleepingWindows() {
        const windowCount = 1 + Math.floor(Math.random() * 2);

        for (let i = 0; i < windowCount; i++) {
            const windowGroup = new THREE.Group();
            
            // Window frame
            const frameGeo = new THREE.CircleGeometry(0.3, 16);
            const frameMat = new THREE.MeshBasicMaterial({
                color: 0xFFE4B5,
                transparent: true,
                opacity: 0.5
            });
            const frame = new THREE.Mesh(frameGeo, frameMat);
            windowGroup.add(frame);

            // Silhouette (simple shape)
            const silhouetteGeo = new THREE.SphereGeometry(0.15, 8, 8);
            const silhouetteMat = new THREE.MeshBasicMaterial({ color: 0x444466 });
            const silhouette = new THREE.Mesh(silhouetteGeo, silhouetteMat);
            silhouette.position.y = -0.05;
            silhouette.scale.y = 0.6;
            windowGroup.add(silhouette);

            // Position floating near castle
            windowGroup.position.set(
                (Math.random() - 0.5) * 6,
                2 + Math.random() * 3,
                2 + Math.random() * 2
            );

            windowGroup.userData = {
                animationType: 'float',
                animationOffset: Math.random() * 10,
                floatSpeed: 0.3 + Math.random() * 0.3
            };

            this.group.add(windowGroup);
            this.decorations.push(windowGroup);
        }
    }

    private createFlowerGardens() {
        const gardenCount = 1 + Math.floor(Math.random() * 2);
        const flowerColors = [
            0xFF69B4,  // Hot pink
            0xFFD700,  // Gold
            0xFF6347,  // Tomato
            0xDA70D6,  // Orchid
            0x00CED1   // Dark turquoise
        ];

        for (let i = 0; i < gardenCount; i++) {
            const garden = new THREE.Group();
            
            const flowerCount = 3 + Math.floor(Math.random() * 4);
            for (let f = 0; f < flowerCount; f++) {
                const flowerColor = flowerColors[Math.floor(Math.random() * flowerColors.length)];
                const flower = this.createGlowingFlower(flowerColor);
                
                flower.position.set(
                    (Math.random() - 0.5) * 1.5,
                    Math.random() * 0.3,
                    (Math.random() - 0.5) * 1.5
                );
                
                garden.add(flower);
                this.flowers.push(flower);
            }

            // Position on cloud edge
            const angle = Math.random() * Math.PI * 2;
            garden.position.set(
                Math.cos(angle) * 1.5,
                1,
                Math.sin(angle) * 1.5
            );

            this.group.add(garden);
            this.decorations.push(garden);
        }
    }

    private createGlowingFlower(colorHex: number): THREE.Mesh {
        const group = new THREE.Group();

        // Stem
        const stemGeo = new THREE.CylinderGeometry(0.02, 0.03, 0.4, 6);
        const stemMat = new THREE.MeshStandardMaterial({ color: 0x228B22 });
        const stem = new THREE.Mesh(stemGeo, stemMat);
        stem.position.y = 0.2;
        group.add(stem);

        // Petals
        const petalGeo = new THREE.SphereGeometry(0.1, 8, 8);
        const petalMat = new THREE.MeshStandardMaterial({
            color: colorHex,
            emissive: colorHex,
            emissiveIntensity: 0.3
        });
        
        for (let i = 0; i < 5; i++) {
            const petal = new THREE.Mesh(petalGeo, petalMat);
            const angle = (i / 5) * Math.PI * 2;
            petal.position.set(
                Math.cos(angle) * 0.08,
                0.4,
                Math.sin(angle) * 0.08
            );
            petal.scale.set(0.5, 0.3, 0.5);
            group.add(petal);
        }

        // Center glow
        const centerGeo = new THREE.SphereGeometry(0.05, 8, 8);
        const centerMat = new THREE.MeshBasicMaterial({ color: 0xFFFFE0 });
        const center = new THREE.Mesh(centerGeo, centerMat);
        center.position.y = 0.4;
        group.add(center);

        group.userData = {
            animationType: 'flowerSway',
            animationOffset: Math.random() * 10
        };

        return group as any;
    }

    private createBells() {
        const bellCount = 1 + Math.floor(Math.random() * 2);

        for (let i = 0; i < bellCount; i++) {
            const bellGroup = new THREE.Group();

            // Bell shape
            const bellGeo = new THREE.ConeGeometry(0.1, 0.2, 8, 1, true);
            const bellMat = new THREE.MeshStandardMaterial({
                color: 0xFFD700,
                metalness: 0.8,
                roughness: 0.2
            });
            const bell = new THREE.Mesh(bellGeo, bellMat);
            bell.position.y = -0.1;
            bellGroup.add(bell);

            // Clapper
            const clapperGeo = new THREE.SphereGeometry(0.03, 6, 6);
            const clapperMat = new THREE.MeshStandardMaterial({ color: 0x444444 });
            const clapper = new THREE.Mesh(clapperGeo, clapperMat);
            clapper.position.y = -0.2;
            bellGroup.add(clapper);

            // String
            const stringGeo = new THREE.CylinderGeometry(0.005, 0.005, 0.5, 4);
            const stringMat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });
            const string = new THREE.Mesh(stringGeo, stringMat);
            string.position.y = 0.25;
            bellGroup.add(string);

            // Position hanging from tower
            bellGroup.position.set(
                (Math.random() - 0.5) * 2,
                4 + Math.random() * 2,
                (Math.random() - 0.5) * 2
            );

            bellGroup.userData = {
                animationType: 'bellSwing',
                animationOffset: Math.random() * 10
            };

            this.group.add(bellGroup);
            this.decorations.push(bellGroup);
        }
    }

    private createGlowLights() {
        // Warm point lights for windows
        const lightCount = Math.min(2, this.windows.length);

        for (let i = 0; i < lightCount; i++) {
            const light = new THREE.PointLight(0xFFE4B5, 0.5, 8);
            light.position.set(
                (Math.random() - 0.5) * 3,
                2 + Math.random() * 2,
                1
            );
            this.group.add(light);
            this.glowLights.push(light);
        }
    }

    // --- Animation Methods ---

    float(): void {
        const time = performance.now() * 0.001;
        const y = this.baseY + Math.sin(time * this.floatSpeed + this.floatOffset) * this.floatAmplitude;
        this.group.position.y = y;

        // Slight tilt
        const tiltX = Math.sin(time * this.floatSpeed * 0.5 + this.floatOffset) * 0.02;
        const tiltZ = Math.cos(time * this.floatSpeed * 0.3 + this.floatOffset) * 0.02;
        this.group.rotation.x = tiltX;
        this.group.rotation.z = tiltZ;
    }

    twinkleWindows(): void {
        this.windowTwinkleTimer += 0.016;

        if (this.windowTwinkleTimer > 2 && Math.random() < 0.3) {
            this.windowTwinkleTimer = 0;
            
            // Randomly brighten a window
            const window = this.windows[Math.floor(Math.random() * this.windows.length)];
            if (window) {
                const material = window.material as THREE.Material;
                // Create a quick brighten effect
                // Note: In a full implementation, we'd animate the emissive intensity
            }
        }
    }

    update(dt: number): void {
        // Main floating animation
        this.float();

        // Window twinkling
        this.twinkleWindows();

        // Update decorations
        const time = performance.now() * 0.001;
        
        this.decorations.forEach(decoration => {
            const data = decoration.userData;
            if (!data) return;

            switch (data.animationType) {
                case 'sparkle':
                    // Twinkle sparkle
                    const sparkle = decoration as THREE.Mesh;
                    const material = sparkle.material as THREE.MeshBasicMaterial;
                    if (material) {
                        material.opacity = 0.3 + Math.sin(time * 3 + data.animationOffset) * 0.3 + 0.3;
                    }
                    // Float along bridge
                    if (data.basePos) {
                        sparkle.position.y = data.basePos.y + Math.sin(time + data.animationOffset) * 0.1;
                    }
                    break;

                case 'float':
                    // Floating sleeping windows
                    decoration.position.y += Math.sin(time * data.floatSpeed + data.animationOffset) * 0.002;
                    decoration.rotation.y = Math.sin(time * 0.5 + data.animationOffset) * 0.1;
                    break;

                case 'flowerSway':
                    // Sway flowers
                    decoration.rotation.z = Math.sin(time * 0.5 + data.animationOffset) * 0.1;
                    break;

                case 'bellSwing':
                    // Gentle bell swing
                    decoration.rotation.z = Math.sin(time * 0.8 + data.animationOffset) * 0.15;
                    decoration.rotation.x = Math.cos(time * 0.6 + data.animationOffset) * 0.1;
                    break;

                case 'flagWave':
                    // Subtle flag wave
                    decoration.rotation.y = Math.sin(time * 2 + data.animationOffset) * 0.1;
                    break;
            }
        });

        // Update flowers
        this.flowers.forEach(flower => {
            const data = flower.userData;
            if (data && data.animationType === 'flowerSway') {
                flower.rotation.z = Math.sin(time * 0.7 + data.animationOffset) * 0.15;
                flower.rotation.x = Math.cos(time * 0.5 + data.animationOffset) * 0.1;
            }
        });

        // Pulse glow lights
        this.glowLights.forEach((light, i) => {
            light.intensity = 0.4 + Math.sin(time * 2 + i) * 0.2;
        });
    }

    getPosition(): THREE.Vector3 {
        return this.group.position.clone();
    }

    setVisible(visible: boolean): void {
        this.group.visible = visible;
    }

    dispose(): void {
        // Clean up resources
        this.group.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(m => m.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            }
        });
    }
}

// --- Castle Background Manager ---

export class CastleBackgroundManager {
    scene: THREE.Scene;
    castles: CloudCastle[] = [];
    shootingStars: ShootingStarSystem;
    
    // Parallax layers
    layerConfig = {
        background: { speed: 0.02, scale: 1.5, yRange: [8, 15], z: -40 },
        midground: { speed: 0.05, scale: 1.0, yRange: [5, 12], z: -25 },
        foreground: { speed: 0.1, scale: 0.6, yRange: [2, 8], z: -15 }
    };

    parallaxSpeed: number = 1.0;
    lastPlayerX: number = 0;
    spawnRange: number = 300;
    cleanupRange: number = 400;

    constructor(scene: THREE.Scene) {
        this.scene = scene;
        this.shootingStars = new ShootingStarSystem(scene);
    }

    generateCastleField(count: number, xMin: number, xMax: number): void {
        const range = xMax - xMin;
        
        for (let i = 0; i < count; i++) {
            const t = i / Math.max(1, count - 1);
            const x = xMin + t * range + (Math.random() - 0.5) * 50;
            
            // Mix of all layers
            const layerType = Math.random();
            let layer: keyof typeof this.layerConfig;
            if (layerType < 0.3) layer = 'background';
            else if (layerType < 0.7) layer = 'midground';
            else layer = 'foreground';

            this.spawnCastleAtLayer(x, layer);
        }
    }

    spawnCastle(x: number, scale?: number): CloudCastle {
        // Default to midground if not specified
        return this.spawnCastleAtLayer(x, 'midground', scale);
    }

    private spawnCastleAtLayer(
        x: number, 
        layer: keyof typeof this.layerConfig,
        customScale?: number
    ): CloudCastle {
        const config = this.layerConfig[layer];
        
        const y = config.yRange[0] + Math.random() * (config.yRange[1] - config.yRange[0]);
        const position = new THREE.Vector3(x, y, config.z + (Math.random() - 0.5) * 10);
        
        const scale = customScale ?? config.scale * (0.8 + Math.random() * 0.4);
        
        const castle = new CloudCastle(position, scale);
        castle.group.userData = {
            layer: layer,
            baseX: x,
            parallaxSpeed: config.speed
        };

        this.scene.add(castle.group);
        this.castles.push(castle);

        return castle;
    }

    update(dt: number, playerX: number): void {
        this.lastPlayerX = playerX;

        // Update castles with parallax
        this.castles.forEach(castle => {
            const layer = castle.group.userData.layer as keyof typeof this.layerConfig;
            const baseX = castle.group.userData.baseX as number;
            const speed = castle.group.userData.parallaxSpeed as number;

            // Parallax movement - castles move slower than player
            const parallaxOffset = (playerX - baseX) * speed * this.parallaxSpeed;
            castle.group.position.x = baseX - parallaxOffset;

            // Update castle animations
            castle.update(dt);
        });

        // Update shooting stars
        this.shootingStars.update(dt, playerX);

        // Spawn new castles as needed
        this.maintainCastles(playerX);

        // Cleanup far castles
        this.cleanupFarCastles(playerX);
    }

    private maintainCastles(playerX: number): void {
        // Check if we need more castles ahead
        const aheadCastles = this.castles.filter(c => 
            c.group.userData.baseX > playerX && 
            c.group.userData.baseX < playerX + this.spawnRange
        );

        // If few castles ahead, spawn more
        if (aheadCastles.length < 3) {
            const spawnX = playerX + this.spawnRange * 0.8 + Math.random() * 50;
            
            // Random layer
            const layers: (keyof typeof this.layerConfig)[] = ['background', 'midground', 'foreground'];
            const layer = layers[Math.floor(Math.random() * layers.length)];
            
            this.spawnCastleAtLayer(spawnX, layer);
        }

        // Also check behind for background layer
        const behindBgCastles = this.castles.filter(c => 
            c.group.userData.layer === 'background' &&
            c.group.userData.baseX < playerX && 
            c.group.userData.baseX > playerX - this.spawnRange
        );

        if (behindBgCastles.length < 2) {
            const spawnX = playerX - this.spawnRange * 0.8 - Math.random() * 50;
            this.spawnCastleAtLayer(spawnX, 'background');
        }
    }

    cleanupFarCastles(playerX: number): void {
        const toRemove: CloudCastle[] = [];

        this.castles.forEach(castle => {
            const distance = Math.abs(castle.group.position.x - playerX);
            
            if (distance > this.cleanupRange) {
                toRemove.push(castle);
            }
        });

        toRemove.forEach(castle => {
            this.scene.remove(castle.group);
            castle.dispose();
            const index = this.castles.indexOf(castle);
            if (index > -1) {
                this.castles.splice(index, 1);
            }
        });
    }

    setParallaxSpeed(speed: number): void {
        this.parallaxSpeed = speed;
    }

    getCastleCount(): number {
        return this.castles.length;
    }

    clear(): void {
        this.castles.forEach(castle => {
            this.scene.remove(castle.group);
            castle.dispose();
        });
        this.castles = [];
    }
}

// --- Helper Functions for Direct Use ---

export function createDreamyCastleBackground(scene: THREE.Scene): CastleBackgroundManager {
    const manager = new CastleBackgroundManager(scene);
    manager.generateCastleField(15, -200, 500);
    return manager;
}

// Default export
export default {
    CloudCastle,
    CastleBackgroundManager,
    createDreamyCastleBackground,
    PASTEL_COLORS,
    RAINBOW_COLORS
};
