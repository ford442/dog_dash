import * as THREE from 'three';
import type { GhostRecording } from './types';

export class GhostRunReplayer {
    private mesh: THREE.Group | null = null;
    private visible = true;
    private recording: GhostRecording | null = null;

    setRecording(recording: GhostRecording | null): void {
        this.recording = recording;
    }

    setVisible(value: boolean): void {
        this.visible = value;
        if (this.mesh) this.mesh.visible = value;
    }

    isVisible(): boolean {
        return this.visible;
    }

    ensureMesh(scene: THREE.Scene): void {
        if (this.mesh) return;

        const group = new THREE.Group();
        const bodyGeo = new THREE.ConeGeometry(0.5, 1.2, 8);
        const bodyMat = new THREE.MeshStandardMaterial({
            color: 0x88ccff,
            transparent: true,
            opacity: 0.35,
            depthWrite: false,
            emissive: 0x4488ff,
            emissiveIntensity: 0.4
        });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.rotation.z = -Math.PI / 2;
        group.add(body);

        const noseGeo = new THREE.SphereGeometry(0.25, 8, 8);
        const nose = new THREE.Mesh(noseGeo, bodyMat.clone());
        nose.position.set(0.6, 0, 0);
        group.add(nose);

        group.visible = this.visible;
        scene.add(group);
        this.mesh = group;
    }

    /** Interpolate ghost pose from recording elapsed time (seconds). */
    update(elapsed: number, scene: THREE.Scene): void {
        if (!this.recording || this.recording.frames.length === 0) return;
        this.ensureMesh(scene);
        if (!this.mesh) return;

        const frames = this.recording.frames;
        let i = 0;
        while (i < frames.length - 1 && frames[i + 1].t < elapsed) i++;

        const a = frames[i];
        const b = frames[Math.min(i + 1, frames.length - 1)];
        const span = Math.max(1e-6, b.t - a.t);
        const u = b === a ? 0 : Math.min(1, (elapsed - a.t) / span);

        this.mesh.position.set(
            a.x + (b.x - a.x) * u,
            a.y + (b.y - a.y) * u,
            0
        );
        this.mesh.visible = this.visible;
    }

    dispose(scene: THREE.Scene): void {
        if (!this.mesh) return;
        scene.remove(this.mesh);
        this.mesh.traverse((obj) => {
            const mesh = obj as THREE.Mesh;
            mesh.geometry?.dispose();
            if (Array.isArray(mesh.material)) {
                mesh.material.forEach((m) => m.dispose());
            } else {
                mesh.material?.dispose();
            }
        });
        this.mesh = null;
    }
}

export const ghostRunReplayer = new GhostRunReplayer();
