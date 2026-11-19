/**
 * `?gallery` — dev review page for game assets.
 *
 * Lays out every registered {@link GalleryEntry} on its own turntable (one
 * scene + camera per cell, drawn into a scissored viewport of a single WebGPU
 * canvas). WebGPU can't run in CI, so this page is how a reviewer checks
 * silhouettes, fronts, tells and hitboxes.
 *
 * Toolbar / URL parameters (all optional, so a review link can pin a view):
 * - `only=hazard,enemy,boss`  category filter (also pickup, powerup, projectile, slingable, player)
 * - `mode=idle|telegraph|hit` gameplay state to preview
 * - `phase=entering|phase1|phase2|phase3|defeated` boss phase
 * - `chapter=1..6`            palette / tint chapter
 * - `tint=0`                  don't apply the chapter `enemyTintColor`
 * - `silhouette`              flat-black on white
 * - `px=64`                   fixed cell size (the 64 px silhouette test)
 * - `spin=0`                  stop the turntable (in-game side view)
 * - `hitboxes`                overlay collision circles (red = damaging / weak point, blue = shield)
 */

import * as THREE from 'three';
import { createGameRenderer, WebGpuBootError } from '../renderer_mode';
import type { BossPhase } from '../boss_system/types';
import {
    GALLERY_CATEGORY_LABELS,
    GALLERY_CATEGORY_ORDER,
    getGalleryEntries,
    type GalleryCategory,
    type GalleryContext,
    type GalleryEntry,
    type GalleryInstance,
    type GalleryMode
} from './registry';

interface Cell {
    entry: GalleryEntry;
    el: HTMLDivElement;
    view: HTMLDivElement;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    pivot: THREE.Group;
    instance: GalleryInstance | null;
    hitboxGroup: THREE.Group;
    hitboxKey: string;
    fit: { center: THREE.Vector3; radius: number };
    /** Original materials while the silhouette swap is active. */
    swapped: Map<THREE.Mesh, THREE.Material | THREE.Material[]> | null;
    hidden: THREE.Object3D[];
    error?: string;
}

interface GalleryState {
    ctx: GalleryContext;
    only: Set<GalleryCategory> | null;
    silhouette: boolean;
    px: number | null;
    spin: boolean;
    hitboxes: boolean;
}

const MODES: GalleryMode[] = ['idle', 'telegraph', 'hit'];
const PHASES: Array<{ id: BossPhase; label: string }> = [
    { id: 'entering', label: 'Entering' },
    { id: 'phase1', label: 'P1 Gale' },
    { id: 'phase2', label: 'P2 Shear' },
    { id: 'phase3', label: 'P3 Eye' },
    { id: 'defeated', label: 'Defeated' }
];

const SILHOUETTE_MATERIAL = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide });

/**
 * Flat-black silhouette by swapping each mesh's material (a scene-wide
 * overrideMaterial trips the node builder on some objects). Additive glows,
 * points and lines are hidden: they are effects, not the shape.
 */
function setSilhouette(cell: Cell, on: boolean): void {
    if (on === (cell.swapped !== null) || !cell.instance) return;
    if (on) {
        cell.swapped = new Map();
        cell.hidden = [];
        cell.instance.object.traverse((o) => {
            const mesh = o as THREE.Mesh;
            const isEffect = (o as THREE.Points).isPoints || (o as THREE.Line).isLine || (o as THREE.Sprite).isSprite;
            const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
            const additive = mat && !Array.isArray(mat) && mat.blending === THREE.AdditiveBlending;
            if (isEffect || additive) {
                if (o.visible) cell.hidden.push(o);
                o.visible = false;
            } else if (mesh.isMesh && mat) {
                cell.swapped!.set(mesh, mat);
                mesh.material = SILHOUETTE_MATERIAL;
            }
        });
    } else {
        for (const [mesh, mat] of cell.swapped!) mesh.material = mat;
        for (const o of cell.hidden) o.visible = true;
        cell.swapped = null;
        cell.hidden = [];
    }
}

function readState(): GalleryState {
    const q = new URLSearchParams(window.location.search);
    const flag = (name: string, dflt: boolean) => {
        if (!q.has(name)) return dflt;
        const v = q.get(name);
        return v !== '0' && v !== 'false';
    };
    const mode = (q.get('mode') as GalleryMode) ?? 'idle';
    const phase = (q.get('phase') as BossPhase) ?? 'phase1';
    const only = q.get('only');
    return {
        ctx: {
            mode: MODES.includes(mode) ? mode : 'idle',
            bossPhase: PHASES.some((p) => p.id === phase) ? phase : 'phase1',
            chapter: THREE.MathUtils.clamp(Number(q.get('chapter') ?? 1) || 1, 1, 6),
            applyTint: flag('tint', true)
        },
        only: only ? new Set(only.split(',') as GalleryCategory[]) : null,
        silhouette: flag('silhouette', false),
        px: q.get('px') ? Number(q.get('px')) : null,
        spin: flag('spin', true),
        hitboxes: flag('hitboxes', false)
    };
}

function writeState(s: GalleryState): void {
    const q = new URLSearchParams();
    q.set('gallery', '');
    if (s.only) q.set('only', [...s.only].join(','));
    if (s.ctx.mode !== 'idle') q.set('mode', s.ctx.mode);
    if (s.ctx.bossPhase !== 'phase1') q.set('phase', s.ctx.bossPhase);
    if (s.ctx.chapter !== 1) q.set('chapter', String(s.ctx.chapter));
    if (!s.ctx.applyTint) q.set('tint', '0');
    if (s.silhouette) q.set('silhouette', '');
    if (s.px) q.set('px', String(s.px));
    if (!s.spin) q.set('spin', '0');
    if (s.hitboxes) q.set('hitboxes', '');
    const str = q.toString().replace(/=(?=&|$)/g, '');
    window.history.replaceState(null, '', `${window.location.pathname}?${str}`);
}

const CSS = `
:root { color-scheme: dark; --bg: #0b1020; --panel: #151c33; --line: #2a3558; --text: #e6ecff; --muted: #8b97bd; --accent: #7cf3ff; }
html, body { margin: 0; height: 100%; background: var(--bg); color: var(--text); font: 13px/1.35 system-ui, sans-serif; overflow: hidden; }
body.silhouette { --bg: #ffffff; --text: #111; --muted: #666; --line: #ddd; --panel: #f3f3f3; }
#gallery-canvas { position: fixed; inset: 0; width: 100vw; height: 100vh; display: block; }
#gallery-bar { position: fixed; top: 0; left: 0; right: 0; z-index: 2; display: flex; flex-wrap: wrap; gap: 6px 14px; align-items: center;
  padding: 8px 16px; background: var(--panel); border-bottom: 1px solid var(--line); }
#gallery-bar h1 { font-size: 14px; margin: 0 8px 0 0; }
#gallery-bar .grp { display: flex; gap: 4px; align-items: center; }
#gallery-bar .grp > span { color: var(--muted); margin-right: 2px; }
#gallery-bar button { font: inherit; color: var(--text); background: transparent; border: 1px solid var(--line); border-radius: 6px; padding: 3px 8px; cursor: pointer; }
#gallery-bar button.on { border-color: var(--accent); color: var(--accent); }
body.silhouette #gallery-bar button.on { border-color: #000; color: #000; font-weight: 600; }
#gallery-grid { position: fixed; left: 0; right: 0; bottom: 0; z-index: 1; display: grid; gap: 8px; padding: 8px 16px; grid-auto-flow: dense;
  align-content: start; pointer-events: none; overflow: hidden; }
.cell { border: 1px solid var(--line); border-radius: 8px; display: flex; flex-direction: column; min-width: 0; }
.cell .view { flex: 1; min-height: 0; }
.cell .label { padding: 3px 6px; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cell .note { padding: 0 6px 4px; font-size: 11px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cell .err { color: #ff6b6b; padding: 6px; font-size: 11px; }
body.small .cell .note { display: none; }
body.small .cell .label { font-size: 10px; padding: 1px 3px; }
`;

function button(label: string, on: boolean, onClick: () => void): HTMLButtonElement {
    const b = document.createElement('button');
    b.textContent = label;
    b.className = on ? 'on' : '';
    b.addEventListener('click', onClick);
    return b;
}

function group(label: string, buttons: HTMLButtonElement[]): HTMLDivElement {
    const g = document.createElement('div');
    g.className = 'grp';
    const s = document.createElement('span');
    s.textContent = label;
    g.append(s, ...buttons);
    return g;
}

function makeHitboxRing(radius: number, weak: boolean): THREE.Mesh {
    // Thin torus rather than a LineLoop (line primitives fail to build under the WebGPU node renderer here).
    const ring = new THREE.Mesh(
        new THREE.TorusGeometry(radius, Math.max(0.015, radius * 0.018), 6, 96),
        new THREE.MeshBasicMaterial({ color: weak ? 0xff3355 : 0x3399ff, depthTest: false, transparent: true })
    );
    ring.renderOrder = 10;
    return ring;
}

export async function startAssetGallery(): Promise<void> {
    document.title = 'Dog Dash — asset gallery';
    document.body.innerHTML = '';
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    const canvas = document.createElement('canvas');
    canvas.id = 'gallery-canvas';
    const bar = document.createElement('div');
    bar.id = 'gallery-bar';
    const grid = document.createElement('div');
    grid.id = 'gallery-grid';
    document.body.append(canvas, grid, bar);

    let renderer: Awaited<ReturnType<typeof createGameRenderer>>['renderer'];
    try {
        ({ renderer } = await createGameRenderer(canvas, { antialias: true }));
    } catch (err) {
        const msg = err instanceof WebGpuBootError ? err.probe.reason : String(err);
        bar.textContent = `Asset gallery needs WebGPU: ${msg}`;
        return;
    }
    renderer.autoClear = false;
    renderer.toneMappingExposure = 1.15;

    // Entry modules register on import; keep this lazy so the game bundle never pulls them in.
    await import('./hazard_entries');
    await import('./pickup_entries');

    const state = readState();
    let cells: Cell[] = [];

    const buildCell = (entry: GalleryEntry): Cell => {
        const el = document.createElement('div');
        el.className = 'cell';
        const view = document.createElement('div');
        view.className = 'view';
        const label = document.createElement('div');
        label.className = 'label';
        label.textContent = entry.label;
        el.append(view, label);
        if (entry.note) {
            const note = document.createElement('div');
            note.className = 'note';
            note.textContent = entry.note;
            el.append(note);
        }
        if (entry.span === 2) {
            el.style.gridColumn = 'span 2';
            el.style.gridRow = 'span 2';
        }

        const scene = new THREE.Scene();
        scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x302040, 1.6));
        const key = new THREE.DirectionalLight(0xffffff, 2.2);
        key.position.set(-3, 4, 5);
        scene.add(key);
        const rim = new THREE.DirectionalLight(0x88ccff, 1.0);
        rim.position.set(4, 1, -4);
        scene.add(rim);

        const pivot = new THREE.Group();
        scene.add(pivot);
        const hitboxGroup = new THREE.Group();
        scene.add(hitboxGroup);
        const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 500);
        const cell: Cell = {
            entry, el, view, scene, camera, pivot, instance: null, hitboxGroup,
            hitboxKey: '', fit: { center: new THREE.Vector3(), radius: 1 }, swapped: null, hidden: []
        };

        try {
            const inst = entry.build(state.ctx);
            cell.instance = inst;
            pivot.add(inst.object);
            inst.update?.(1 / 60, 0, state.ctx);
            // A box's circumsphere overstates a roundish object by up to √3; 0.8 frames it snugly
            // while leaving room for the turntable.
            const sphere = new THREE.Box3().setFromObject(pivot).getBoundingSphere(new THREE.Sphere());
            cell.fit = { center: sphere.center.clone(), radius: Math.max(0.3, sphere.radius * 0.8) };
        } catch (err) {
            cell.error = err instanceof Error ? err.message : String(err);
            const e = document.createElement('div');
            e.className = 'err';
            e.textContent = `build failed: ${cell.error}`;
            view.append(e);
            console.error(`[gallery] ${entry.id}`, err);
        }
        return cell;
    };

    const disposeCells = () => {
        for (const c of cells) {
            try { c.instance?.dispose?.(); } catch { /* best effort */ }
        }
        cells = [];
        grid.innerHTML = '';
    };

    const rebuild = () => {
        disposeCells();
        const entries = getGalleryEntries().filter((e) => !state.only || state.only.has(e.category));
        cells = entries.map(buildCell);
        grid.append(...cells.map((c) => c.el));
        layout();
    };

    const layout = () => {
        const top = bar.getBoundingClientRect().height;
        grid.style.top = `${top}px`;
        const units = cells.reduce((n, c) => n + (c.entry.span === 2 ? 4 : 1), 0) || 1;
        const w = window.innerWidth - 32;
        const h = window.innerHeight - top - 16;
        let size = state.px ?? Math.floor(Math.sqrt((w * h) / (units * 1.35)));
        size = Math.max(state.px ? 32 : 90, Math.min(size, 320));
        // Shrink until the grid fits without scrolling (scissor rects must stay on-canvas).
        if (!state.px) {
            for (; size > 60; size -= 4) {
                const cols = Math.max(2, Math.floor((w + 8) / (size + 8)));
                const rows = Math.ceil(units / cols) + 1;
                if (rows * (size + 8 + 30) <= h) break;
            }
        }
        const labelH = state.px ? 14 : 34;
        grid.style.gridTemplateColumns = `repeat(auto-fill, ${size}px)`;
        grid.style.gridAutoRows = `${size + labelH}px`;
        document.body.classList.toggle('small', !!state.px && state.px < 120);
    };

    const renderBar = () => {
        bar.innerHTML = '';
        const h1 = document.createElement('h1');
        h1.textContent = 'Asset gallery';
        const set = (fn: () => void, rebuildNeeded = false) => () => {
            fn();
            writeState(state);
            renderBar();
            if (rebuildNeeded) rebuild(); else layout();
        };
        const cats = GALLERY_CATEGORY_ORDER.filter((c) => getGalleryEntries().some((e) => e.category === c));
        bar.append(
            h1,
            group('Show', [
                button('All', !state.only, set(() => { state.only = null; }, true)),
                ...cats.map((c) => button(GALLERY_CATEGORY_LABELS[c], !!state.only?.has(c) && state.only.size === 1,
                    set(() => { state.only = new Set([c]); }, true)))
            ]),
            group('State', MODES.map((m) => button(m[0].toUpperCase() + m.slice(1), state.ctx.mode === m,
                set(() => { state.ctx.mode = m; })))),
            group('Boss', PHASES.map((p) => button(p.label, state.ctx.bossPhase === p.id,
                set(() => { state.ctx.bossPhase = p.id; })))),
            group('Chapter', [1, 2, 3, 4, 5, 6].map((n) => button(String(n), state.ctx.chapter === n,
                set(() => { state.ctx.chapter = n; }, true)))),
            group('View', [
                button('Tint', state.ctx.applyTint, set(() => { state.ctx.applyTint = !state.ctx.applyTint; }, true)),
                button('Silhouette', state.silhouette, set(() => { state.silhouette = !state.silhouette; })),
                button('64 px', state.px === 64, set(() => { state.px = state.px === 64 ? null : 64; })),
                button('Spin', state.spin, set(() => { state.spin = !state.spin; })),
                button('Hitboxes', state.hitboxes, set(() => { state.hitboxes = !state.hitboxes; }))
            ])
        );
        document.body.classList.toggle('silhouette', state.silhouette);
    };

    renderBar();
    rebuild();
    window.addEventListener('resize', () => {
        renderer.setSize(window.innerWidth, window.innerHeight);
        layout();
    });

    const clock = new THREE.Clock();
    let t = 0;
    const clearDark = new THREE.Color(0x0b1020);
    const clearLight = new THREE.Color(0xffffff);

    const frame = () => {
        const dt = Math.min(clock.getDelta(), 1 / 20);
        t += dt;

        renderer.setScissorTest(false);
        renderer.setClearColor(state.silhouette ? clearLight : clearDark, 1);
        renderer.clear();
        renderer.setScissorTest(true);

        const cw = window.innerWidth;
        const ch = window.innerHeight;
        for (const cell of cells) {
            if (!cell.instance) continue;
            try {
                cell.instance.update?.(dt, t, state.ctx);
            } catch (err) {
                console.error(`[gallery] update ${cell.entry.id}`, err);
                cell.instance.update = undefined;
            }
            cell.pivot.rotation.y = state.spin ? t * 0.6 : 0;

            // Hitbox overlay (rebuilt only when the circles change).
            const boxes = state.hitboxes && !state.silhouette && cell.instance.hitboxes
                ? cell.instance.hitboxes(state.ctx)
                : [];
            const key = JSON.stringify(boxes);
            if (key !== cell.hitboxKey) {
                cell.hitboxKey = key;
                for (const old of [...cell.hitboxGroup.children] as THREE.Mesh[]) {
                    old.geometry.dispose();
                    (old.material as THREE.Material).dispose();
                    cell.hitboxGroup.remove(old);
                }
                for (const hb of boxes) {
                    const ring = makeHitboxRing(hb.radius, hb.weak !== false);
                    ring.position.set(hb.x, hb.y, 0);
                    cell.hitboxGroup.add(ring);
                }
            }
            setSilhouette(cell, state.silhouette);

            const r = cell.view.getBoundingClientRect();
            if (r.width < 4 || r.height < 4) continue;
            if (r.left < 0 || r.top < 0 || r.right > cw || r.bottom > ch) continue;
            const aspect = r.width / r.height;
            const { center, radius } = cell.fit;
            const dist = radius / Math.sin(THREE.MathUtils.degToRad(cell.camera.fov / 2)) / Math.min(1, aspect) * 1.02;
            cell.camera.aspect = aspect;
            cell.camera.position.set(center.x, center.y + radius * 0.12, center.z + dist);
            cell.camera.lookAt(center);
            cell.camera.near = Math.max(0.05, dist - radius * 3);
            cell.camera.far = dist + radius * 3;
            cell.camera.updateProjectionMatrix();
            renderer.setViewport(r.left, r.top, r.width, r.height);
            renderer.setScissor(r.left, r.top, r.width, r.height);
            renderer.render(cell.scene, cell.camera);
        }
        requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);

    // Handy for headless review scripts: resolves once a few frames are on screen.
    (window as unknown as { __galleryReady?: boolean }).__galleryReady = true;
}
