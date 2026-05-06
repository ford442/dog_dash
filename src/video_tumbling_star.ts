import * as THREE from 'three';

// ============================================================================
// Video Tumbling Star Asset (OPTIMIZED for performance)
// - Throttled video texture updates (~30fps)
// - Distance-based culling
// - Lighter materials
// ============================================================================

export class VideoTumblingStar {
    public mesh: THREE.Mesh;
    private video: HTMLVideoElement;
    private texture: THREE.VideoTexture;
    private isPlaying: boolean = false;
    private lastTextureUpdate: number = 0;
    private readonly TEXTURE_THROTTLE_MS = 33; // ~30 fps

    constructor(scene: THREE.Scene, x: number = 25, y: number = 18, z: number = -35) {
        // Create video element
        this.video = document.createElement('video');
        this.video.src = 'https://test.1ink.us/dog-dash/dog_star.mp4';
        this.video.crossOrigin = 'anonymous';
        this.video.loop = true;
        this.video.muted = true;
        this.video.playsInline = true;

        const playPromise = this.video.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                this.isPlaying = true;
                console.log('✅ VideoTumblingStar: video active!');
            }).catch(() => {
                console.log('Video autoplay blocked — click/tap anywhere to start');
                const enable = () => {
                    this.video.play().then(() => { this.isPlaying = true; });
                    document.removeEventListener('click', enable);
                    document.removeEventListener('touchstart', enable);
                };
                document.addEventListener('click', enable, { once: true });
                document.addEventListener('touchstart', enable, { once: true });
            });
        }

        this.texture = new THREE.VideoTexture(this.video);
        this.texture.minFilter = THREE.LinearFilter;
        this.texture.magFilter = THREE.LinearFilter;
        this.texture.generateMipmaps = false;

        // 5-pointed star geometry
        const starShape = new THREE.Shape();
        const outerRadius = 7;
        const innerRadius = 3.5;
        const numPoints = 5;
        for (let i = 0; i < numPoints * 2; i++) {
            const angle = (i * Math.PI / numPoints) - Math.PI / 2;
            const r = (i % 2 === 0) ? outerRadius : innerRadius;
            const px = r * Math.cos(angle);
            const py = r * Math.sin(angle);
            if (i === 0) starShape.moveTo(px, py);
            else starShape.lineTo(px, py);
        }
        starShape.closePath();

        const extrudeSettings = { depth: 2.5, bevelEnabled: true, bevelThickness: 0.4, bevelSize: 0.4, bevelSegments: 3 };
        const geometry = new THREE.ExtrudeGeometry(starShape, extrudeSettings);
        geometry.center();

        const material = new THREE.MeshPhongMaterial({
            map: this.texture,
            shininess: 90,
            specular: 0xcccccc,
            emissive: 0x222222,
            side: THREE.DoubleSide
        });

        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.set(x, y, z);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;

        // Lighter glow layer
        const glowGeo = geometry.clone();
        const glowMat = new THREE.MeshBasicMaterial({
            color: 0xffeeaa,
            transparent: true,
            opacity: 0.12,
            blending: THREE.AdditiveBlending
        });
        const glow = new THREE.Mesh(glowGeo, glowMat);
        glow.scale.set(1.15, 1.15, 1.15);
        this.mesh.add(glow);

        scene.add(this.mesh);
        this.lastTextureUpdate = performance.now();
    }

    public update(deltaTime: number, camera?: THREE.Camera) {
        if (!this.mesh) return;

        // Organic tumble + bob
        this.mesh.rotation.x += deltaTime * 1.1;
        this.mesh.rotation.y += deltaTime * 0.9;
        this.mesh.rotation.z += deltaTime * 0.6;
        this.mesh.position.y += Math.sin(performance.now() / 1200) * 0.015;

        // Distance culling for heavy texture work
        let shouldUpdateTexture = this.isPlaying;
        if (camera) {
            const dist = this.mesh.position.distanceTo(camera.position);
            if (dist > 120) shouldUpdateTexture = false;
        }

        // Throttled texture update (biggest perf win)
        if (shouldUpdateTexture) {
            const now = performance.now();
            if (now - this.lastTextureUpdate > this.TEXTURE_THROTTLE_MS) {
                this.texture.needsUpdate = true;
                this.lastTextureUpdate = now;
            }
        }
    }

    public dispose(scene: THREE.Scene) {
        if (this.mesh && scene) {
            scene.remove(this.mesh);
            this.mesh.geometry.dispose();
            (this.mesh.material as THREE.Material).dispose();
            this.mesh = null as any;
        }
        if (this.video) {
            this.video.pause();
            this.video.src = '';
            this.video.load();
            this.video = null as any;
        }
        if (this.texture) {
            this.texture.dispose();
            this.texture = null as any;
        }
    }
}
