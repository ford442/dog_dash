/**
 * Extractor Beam visuals — one additive TSL beam (a thin cylinder stretched
 * ship → target) plus a slowly spinning target bracket ring. Lower intensity
 * than the glitter/unicorn beams: this is a gentle siphon, not a weapon.
 * Purely visual; budgeted as `extractor_beam` (effects, max 1).
 */

import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { color, float, sin, time, uv, vec4, mix, abs } from 'three/tsl';
import { decorationBudget } from '../decoration_budget';

const BUDGET_ID = 'extractor_beam';
const BEAM_COLOR = 0x66ffcc;

function createBeamMaterial(): MeshBasicNodeMaterial {
    const mat = new MeshBasicNodeMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide
    });
    // Pulses travel from target (uv.y = 1) back to the ship (uv.y = 0).
    const flow = sin(uv().y.mul(28.0).add(time.mul(9.0))).mul(0.5).add(0.5);
    const edge = float(1.0).sub(abs(uv().x.sub(0.5)).mul(2.0));
    const alpha = edge.mul(mix(float(0.18), float(0.5), flow));
    mat.colorNode = vec4(color(BEAM_COLOR).mul(float(0.8).add(flow.mul(0.6))), alpha);
    return mat;
}

function createBracketMaterial(): MeshBasicNodeMaterial {
    const mat = new MeshBasicNodeMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });
    const pulse = sin(time.mul(4.0)).mul(0.25).add(0.75);
    mat.colorNode = vec4(color(BEAM_COLOR), pulse.mul(0.7));
    return mat;
}

export class ExtractorBeamVfx {
    private readonly beam: THREE.Mesh;
    private readonly bracket: THREE.Mesh;
    private readonly fill: THREE.Mesh;
    private visible = false;
    private spin = 0;
    /** Progress arc is rebuilt only when it crosses one of 48 segments. */
    private fillSegments = -1;

    constructor(private readonly scene: THREE.Scene) {
        const beamGeo = new THREE.CylinderGeometry(0.14, 0.32, 1, 8, 1, true);
        beamGeo.translate(0, 0.5, 0); // base at origin, length along +Y
        this.beam = new THREE.Mesh(beamGeo, createBeamMaterial());
        this.beam.frustumCulled = false;
        this.beam.renderOrder = 5;

        const bracketMat = createBracketMaterial();
        // Four-gap ring reads as a lock-on bracket.
        this.bracket = new THREE.Mesh(new THREE.TorusGeometry(1, 0.06, 4, 32, Math.PI * 2), bracketMat);
        this.bracket.frustumCulled = false;
        // Progress arc: a partial ring that fills as the siphon completes.
        this.fill = new THREE.Mesh(new THREE.RingGeometry(1.12, 1.28, 48, 1, 0, 0.0001), bracketMat);
        this.fill.frustumCulled = false;

        this.beam.visible = this.bracket.visible = this.fill.visible = false;
        scene.add(this.beam, this.bracket, this.fill);
    }

    /** Show the beam from `from` to `to`; `radius` sizes the bracket, `progress` 0..1 fills the arc. */
    show(from: THREE.Vector3, to: THREE.Vector3, radius: number, progress: number, dt: number): void {
        if (!this.visible) {
            if (!decorationBudget.canSpawn(BUDGET_ID)) return;
            this.visible = true;
            decorationBudget.syncCount(BUDGET_ID, 1);
        }
        const dir = to.clone().sub(from);
        const len = Math.max(0.01, dir.length());
        this.beam.position.copy(from);
        this.beam.quaternion.setFromUnitVectors(THREE.Object3D.DEFAULT_UP, dir.multiplyScalar(1 / len));
        this.beam.scale.set(1, len, 1);
        this.beam.visible = true;

        this.spin += dt * 1.5;
        const r = Math.max(1, radius) * 1.15;
        this.bracket.position.copy(to);
        this.bracket.rotation.set(0, 0, this.spin);
        this.bracket.scale.setScalar(r);
        this.bracket.visible = true;

        const segments = Math.max(1, Math.round(Math.min(1, progress) * 48));
        if (segments !== this.fillSegments) {
            this.fillSegments = segments;
            this.fill.geometry.dispose();
            // Clockwise from 12 o'clock: start at π/2 − arc, sweep +arc.
            const arc = Math.PI * 2 * (segments / 48);
            this.fill.geometry = new THREE.RingGeometry(1.12, 1.28, segments, 1, Math.PI / 2 - arc, arc);
        }
        this.fill.position.copy(to);
        this.fill.scale.setScalar(r);
        this.fill.visible = true;
    }

    hide(): void {
        if (!this.visible) return;
        this.visible = false;
        this.beam.visible = this.bracket.visible = this.fill.visible = false;
        decorationBudget.syncCount(BUDGET_ID, 0);
    }

    dispose(): void {
        this.hide();
        this.scene.remove(this.beam, this.bracket, this.fill);
        this.beam.geometry.dispose();
        this.bracket.geometry.dispose();
        this.fill.geometry.dispose();
        (this.beam.material as THREE.Material).dispose();
        (this.bracket.material as THREE.Material).dispose();
    }
}
