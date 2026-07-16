import * as THREE from 'three';
import { createPulseOverlayMaterial } from './materials';

export class PulseOverlay {
    mesh: THREE.Mesh;
    camera: THREE.Camera | null = null;

    constructor() {
        const geo = new THREE.PlaneGeometry(2, 2);
        this.mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ visible: false }));
        this.mesh.position.set(0, 0, -1.01);
    }

    init(uPulse: any, camera: THREE.Camera) {
        this.camera = camera;
        this.mesh.material = createPulseOverlayMaterial(uPulse);
        camera.add(this.mesh);
    }
}
