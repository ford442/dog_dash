import * as THREE from 'three';

// ============================================================================
// Video Tumbling Star Asset
// A 5-pointed star mesh with video texture playing on its surface, tumbling in space
// Video source: test.1ink.us/dog-dash/dog_star.mp4
// ============================================================================

export class VideoTumblingStar {
    public mesh: THREE.Mesh;
    private video: HTMLVideoElement;
    private texture: THREE.VideoTexture;
    private isPlaying: boolean = false;

    constructor(scene: THREE.Scene, x: number = 25, y: number = 18, z: number = -35) {
        // Create video element
        this.video = document.createElement('video');
        this.video.src = 'https://test.1ink.us/dog-dash/dog_star.mp4';
        this.video.crossOrigin = 'anonymous';
        this.video.loop = true;
        this.video.muted = true;
        this.video.playsInline = true;

        // Attempt autoplay (muted helps)
        const playPromise = this.video.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                this.isPlaying = true;
                console.log('🎬 Dog Star video texture active and tumbling!');
            }).catch((error) => {
                console.log('Video autoplay prevented by browser policy. Click anywhere to enable.');
                // Fallback: enable on first user interaction
                const enableVideo = () => {
                    this.video.play().then(() => {
                        this.isPlaying = true;
                        console.log('🎥 Video started after user interaction!');
                    });
                    document.removeEventListener('click', enableVideo);
                    document.removeEventListener('touchstart', enableVideo);
                };
                document.addEventListener('click', enableVideo, { once: true });
                document.addEventListener('touchstart', enableVideo, { once: true });
            });
        }

        this.texture = new THREE.VideoTexture(this.video);
        this.texture.minFilter = THREE.LinearFilter;
        this.texture.magFilter = THREE.LinearFilter;
        this.texture.generateMipmaps = false;

        // Create 5-pointed star shape
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

        const extrudeSettings = {
            depth: 2.5,
            bevelEnabled: true,
            bevelThickness: 0.4,
            bevelSize: 0.4,
            bevelSegments: 4
        };
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

        // Subtle glow layer for video pop
        const glowGeo = geometry.clone();
        const glowMat = new THREE.MeshBasicMaterial({
            color: 0xffeeaa,
            transparent: true,
            opacity: 0.15,
            blending: THREE.AdditiveBlending
        });
        const glow = new THREE.Mesh(glowGeo, glowMat);
        glow.scale.set(1.15, 1.15, 1.15);
        this.mesh.add(glow);

        scene.add(this.mesh);
    }

    public update(deltaTime: number) {
        if (!this.mesh) return;

        // Tumbling rotation - different speeds per axis for organic tumble
        this.mesh.rotation.x += deltaTime * 1.1;
        this.mesh.rotation.y += deltaTime * 0.9;
        this.mesh.rotation.z += deltaTime * 0.6;

        // Gentle floating bob
        this.mesh.position.y += Math.sin(performance.now() / 1200) * 0.015;

        // Refresh video texture
        if (this.texture && this.isPlaying) {
            this.texture.needsUpdate = true;
        }
    }

    public dispose(scene: THREE.Scene) {
        if (this.mesh && scene) {
            scene.remove(this.mesh);
            this.mesh.geometry.dispose();
            const mat = this.mesh.material as THREE.Material;
            if (mat) mat.dispose();
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
