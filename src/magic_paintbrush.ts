import * as THREE from 'three';
import { decorationBudget } from './decoration_budget';
import { getRainbowColor } from './magical_effects/shared';

const BUDGET_ID = 'magic_paintbrush_path';
const MAX_SEGMENTS = 36;
const SEGMENT_LIFETIME = 10;
const MIN_PAINT_SPACING = 1.8;
const GUIDE_RADIUS_X = 4;
const GUIDE_RADIUS_Y = 2.5;
const GUIDE_STRENGTH = 12;

interface PaintSegment {
    mesh: THREE.Mesh;
    position: THREE.Vector3;
    lifetime: number;
}

let sharedSegmentGeo: THREE.TorusGeometry | null = null;

function getSegmentGeometry(): THREE.TorusGeometry {
    if (!sharedSegmentGeo) {
        sharedSegmentGeo = new THREE.TorusGeometry(0.55, 0.12, 6, 12);
    }
    return sharedSegmentGeo;
}

export class MagicPaintbrushSystem {
    private scene: THREE.Scene;
    private segments: PaintSegment[] = [];
    private isPainting = false;
    private lastPaintPos?: THREE.Vector3;
    private registered = false;

    constructor(scene: THREE.Scene) {
        this.scene = scene;
    }

    private ensureBudget(): void {
        if (this.registered) return;
        decorationBudget.register(BUDGET_ID, {
            label: 'Rainbow paint path',
            category: 'effects',
            maxActive: MAX_SEGMENTS,
        });
        this.registered = true;
    }

    setPainting(active: boolean): void {
        this.isPainting = active;
        if (!active) this.lastPaintPos = undefined;
    }

    isActivePainting(): boolean {
        return this.isPainting;
    }

    paintAt(worldPos: THREE.Vector3): void {
        if (!this.isPainting) return;

        this.ensureBudget();

        if (this.lastPaintPos && worldPos.distanceTo(this.lastPaintPos) < MIN_PAINT_SPACING) {
            return;
        }
        if (!decorationBudget.canSpawn(BUDGET_ID)) return;

        const hue = (this.segments.length * 0.07) % 1;
        const material = new THREE.MeshBasicMaterial({
            color: getRainbowColor(hue),
            transparent: true,
            opacity: 0.85,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        });

        const mesh = new THREE.Mesh(getSegmentGeometry(), material);
        mesh.position.copy(worldPos);
        mesh.rotation.z = Math.PI / 2;
        mesh.rotation.y = Math.random() * Math.PI;
        this.scene.add(mesh);

        if (!decorationBudget.reportSpawn(BUDGET_ID)) {
            this.scene.remove(mesh);
            material.dispose();
            return;
        }

        this.segments.push({
            mesh,
            position: worldPos.clone(),
            lifetime: SEGMENT_LIFETIME,
        });
        this.lastPaintPos = worldPos.clone();
    }

    /**
     * Gently guide the rocket toward the nearest painted segment on the path.
     */
    applyGuideForce(playerPos: THREE.Vector3, currentSpeedY: number, delta: number): number {
        let bestDist = Infinity;
        let bestSegment: PaintSegment | undefined;

        for (const seg of this.segments) {
            const dx = Math.abs(seg.position.x - playerPos.x);
            const dy = Math.abs(seg.position.y - playerPos.y);
            if (dx > GUIDE_RADIUS_X || dy > GUIDE_RADIUS_Y) continue;
            const dist = dx + dy * 0.5;
            if (dist < bestDist) {
                bestDist = dist;
                bestSegment = seg;
            }
        }

        if (!bestSegment) return currentSpeedY;

        const targetY = bestSegment.position.y;
        const diff = targetY - playerPos.y;
        return currentSpeedY + diff * GUIDE_STRENGTH * delta;
    }

    update(dt: number, _playerPos?: THREE.Vector3): void {
        this.ensureBudget();
        decorationBudget.syncCount(BUDGET_ID, this.segments.length);

        for (let i = this.segments.length - 1; i >= 0; i--) {
            const seg = this.segments[i];
            seg.lifetime -= dt;
            const mat = seg.mesh.material as THREE.MeshBasicMaterial;
            mat.opacity = Math.max(0, (seg.lifetime / SEGMENT_LIFETIME) * 0.85);

            if (seg.lifetime <= 0) {
                this.scene.remove(seg.mesh);
                mat.dispose();
                decorationBudget.reportDestroy(BUDGET_ID);
                this.segments.splice(i, 1);
            }
        }
    }

    clear(): void {
        for (const seg of this.segments) {
            this.scene.remove(seg.mesh);
            (seg.mesh.material as THREE.Material).dispose();
            decorationBudget.reportDestroy(BUDGET_ID);
        }
        this.segments = [];
        this.isPainting = false;
        this.lastPaintPos = undefined;
        decorationBudget.syncCount(BUDGET_ID, 0);
    }
}
