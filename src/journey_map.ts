/**
 * Moon Journey Map — kid-friendly 2D SVG/DOM overlay.
 * Pure overlay UI (no Three.js) so WebGL2 / WebGPU paths are unaffected.
 *
 * Shows Earth → Moon curved path with 6 chapters, objective icons,
 * completion checks, rescued-friends / bestiary totals, next-biome teaser,
 * and a dog cockpit reaction line.
 */

import { LEVEL_CONFIG, type LevelObjectiveType } from './level_config';
import { SaveManager } from './save_manager';
import { BESTIARY_ENTRIES } from './bestiary';
import { SPECIES_NAMES } from './discovery_system';
import { COLORS } from './hud_system/styles';
import {
    CHAPTER_DOG_LINES,
    JOURNEY_MAP_IDLE_LINE,
    getChapterCompleteLine,
    getChapterDogLine
} from './dog_cockpit/chapter_lines';

export type JourneyMapMode = 'pause' | 'chapter' | 'victory';

export interface JourneyMapSnapshot {
    /** Level the player is currently on (1–6). */
    currentLevel: number;
    /** Levels whose chapter objectives are done (or already passed). */
    completedLevels: number[];
    /** Friends rescued this run (flotilla frees). */
    rescuedCount: number;
    /** Persistent flora / species discoveries. */
    discoveredSpeciesCount: number;
    /** Persistent bestiary catalog count. */
    catalogedCreaturesCount: number;
}

export interface ShowJourneyMapOptions {
    mode: JourneyMapMode;
    snapshot: JourneyMapSnapshot;
    /** Chapter just completed (highlight + dog line). */
    completedChapter?: number;
    onClose?: () => void;
    /** When true, auto-dismiss after a short beat (chapter toast). */
    autoCloseMs?: number;
}

const OBJECTIVE_ICONS: Record<LevelObjectiveType, string> = {
    scan: '🌿',
    sling: '🌀',
    rescue: '🐾',
    survive: '🛡️',
    combo: '⚡',
    boss: '👑'
};

const BIOME_TEASERS: Record<number, string> = {
    1: 'Neon gardens & pastel butterflies',
    2: 'Asteroid belt gravity wells',
    3: 'Fiery re-entry skies',
    4: 'Rusty industrial tunnels',
    5: 'Living nebula corridors',
    6: 'Aqua expanse & lunar aurora'
};

const CHAPTER_COUNT = 6;

/** Quadratic Bezier sample for the Earth→Moon path (viewBox 0–1000 x 0–420). */
function pathPoint(t: number): { x: number; y: number } {
    // P0 Earth-ish left, P1 high arc, P2 Moon right
    const p0 = { x: 70, y: 280 };
    const p1 = { x: 500, y: 40 };
    const p2 = { x: 930, y: 260 };
    const u = 1 - t;
    return {
        x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
        y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y
    };
}

function chapterT(level: number): number {
    return (level - 0.5) / CHAPTER_COUNT;
}

function isCompleted(level: number, completed: number[]): boolean {
    return completed.includes(level);
}

function buildSnapshotFromSave(
    saveManager: SaveManager,
    currentLevel: number,
    rescuedCount: number,
    completedLevels?: number[]
): JourneyMapSnapshot {
    const unlocked = saveManager.getUnlockedLevels();
    // A level is "completed" if the next level is unlocked, or it was passed this run.
    const derived: number[] = [];
    for (let L = 1; L <= CHAPTER_COUNT; L++) {
        if (unlocked.includes(L + 1) || (completedLevels && completedLevels.includes(L)) || L < currentLevel) {
            derived.push(L);
        }
    }
    // Level 6 complete if runsCompleted or boss defeat, or explicitly listed
    if (unlocked.includes(7) || (completedLevels && completedLevels.includes(6))) {
        if (!derived.includes(6)) derived.push(6);
    }

    return {
        currentLevel,
        completedLevels: [...new Set(derived)].sort((a, b) => a - b),
        rescuedCount,
        discoveredSpeciesCount: saveManager.getDiscoveredSpecies().length,
        catalogedCreaturesCount: saveManager.getCatalogedCreatures().length
    };
}

export function createJourneyMapSnapshot(
    saveManager: SaveManager,
    currentLevel: number,
    rescuedCount: number,
    completedLevels?: number[]
): JourneyMapSnapshot {
    return buildSnapshotFromSave(saveManager, currentLevel, rescuedCount, completedLevels);
}

let activeMap: HTMLDivElement | null = null;

export function isJourneyMapOpen(): boolean {
    return activeMap !== null;
}

export function hideJourneyMap(): void {
    if (activeMap) {
        activeMap.remove();
        activeMap = null;
    }
}

/**
 * Build and show the Moon Journey Map overlay.
 * Returns the root element (also appended to document.body).
 */
export function showJourneyMap(options: ShowJourneyMapOptions): HTMLDivElement {
    hideJourneyMap();

    const { mode, snapshot, completedChapter, onClose, autoCloseMs } = options;
    const focusLevel = completedChapter ?? snapshot.currentLevel;
    const dogLine =
        mode === 'chapter' && completedChapter
            ? getChapterCompleteLine(completedChapter)
            : mode === 'victory'
                ? 'We made it to the Moon! Good boy — journey complete! 🌕'
                : getChapterDogLine(focusLevel) || JOURNEY_MAP_IDLE_LINE;

    const root = document.createElement('div');
    root.id = 'journey-map-overlay';
    root.setAttribute('data-journey-map', mode);
    root.style.cssText = `
        position: fixed;
        inset: 0;
        z-index: 1100;
        display: flex;
        align-items: center;
        justify-content: center;
        background: radial-gradient(ellipse at 50% 20%, rgba(40, 30, 80, 0.92), rgba(8, 10, 28, 0.96));
        font-family: 'Segoe UI', 'Comic Sans MS', cursive, sans-serif;
        color: ${COLORS.textDark};
        animation: hud-fade-in 0.35s ease-out;
        touch-action: none;
        pointer-events: auto;
    `;

    injectJourneyMapStyles();

    // Parallax star field (DOM, cheap)
    const stars = document.createElement('div');
    stars.className = 'jm-stars';
    stars.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < 48; i++) {
        const s = document.createElement('span');
        const size = 1 + Math.random() * 3;
        s.style.cssText = `
            position: absolute;
            left: ${Math.random() * 100}%;
            top: ${Math.random() * 100}%;
            width: ${size}px;
            height: ${size}px;
            border-radius: 50%;
            background: ${Math.random() > 0.7 ? COLORS.lemon : COLORS.white};
            opacity: ${0.35 + Math.random() * 0.55};
            animation: jm-twinkle ${2 + Math.random() * 3}s ease-in-out ${Math.random() * 2}s infinite;
        `;
        stars.appendChild(s);
    }
    root.appendChild(stars);

    const panel = document.createElement('div');
    panel.className = 'jm-panel hud-element';
    panel.style.cssText = `
        position: relative;
        width: min(920px, 94vw);
        max-height: 92vh;
        overflow: auto;
        background: linear-gradient(160deg, ${COLORS.pinkLight} 0%, ${COLORS.lavender} 55%, ${COLORS.sky} 100%);
        border: 5px solid ${COLORS.white};
        border-radius: 28px;
        box-shadow: 0 18px 50px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.55);
        padding: 18px 18px 22px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        animation: hud-bounce 0.45s ease-out;
    `;

    const header = document.createElement('div');
    header.style.cssText = 'display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap;';
    header.innerHTML = `
        <div>
            <h2 style="margin:0; font-size:clamp(22px,4vw,30px); color:${COLORS.textDark}; text-shadow:1px 1px 0 rgba(255,255,255,0.6);">
                🌍 → 🌕 Moon Journey Map
            </h2>
            <p style="margin:4px 0 0; color:${COLORS.textLight}; font-size:14px; font-weight:600;">
                ${mode === 'chapter' ? 'Chapter complete!' : mode === 'victory' ? 'Full journey complete!' : 'Pause · path to the Moon'}
            </p>
        </div>
    `;

    const closeBtn = document.createElement('button');
    closeBtn.className = 'hud-interactive';
    closeBtn.textContent = '✕ Close';
    closeBtn.style.cssText = menuBtnStyle(COLORS.peach);
    closeBtn.addEventListener('click', () => {
        hideJourneyMap();
        onClose?.();
    });
    header.appendChild(closeBtn);
    panel.appendChild(header);

    // Stats strip
    const floraTotal = Object.keys(SPECIES_NAMES).length;
    const bestiaryTotal = Object.keys(BESTIARY_ENTRIES).length;
    const stats = document.createElement('div');
    stats.style.cssText = `
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        justify-content: center;
    `;
    stats.innerHTML = `
        ${statChip('🐾 Friends rescued', String(snapshot.rescuedCount))}
        ${statChip('🌿 Discoveries', `${snapshot.discoveredSpeciesCount}/${floraTotal}`)}
        ${statChip('📖 Bestiary', `${snapshot.catalogedCreaturesCount}/${bestiaryTotal}`)}
    `;
    panel.appendChild(stats);

    // Zoomable map stage
    const stage = document.createElement('div');
    stage.className = 'jm-stage';
    stage.style.cssText = `
        position: relative;
        width: 100%;
        aspect-ratio: 1000 / 420;
        max-height: 42vh;
        background: linear-gradient(180deg, rgba(20,16,48,0.85), rgba(60,40,90,0.55));
        border-radius: 20px;
        border: 3px solid ${COLORS.white};
        overflow: hidden;
        touch-action: none;
        cursor: grab;
    `;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 1000 420');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.style.cssText = 'width:100%; height:100%; display:block; transform-origin: center center;';

    // Soft path glow + main dashed path
    const pathD = quadraticPath(70, 280, 500, 40, 930, 260);
    const glow = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    glow.setAttribute('d', pathD);
    glow.setAttribute('fill', 'none');
    glow.setAttribute('stroke', 'rgba(255, 215, 120, 0.35)');
    glow.setAttribute('stroke-width', '18');
    glow.setAttribute('stroke-linecap', 'round');
    svg.appendChild(glow);

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathD);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', COLORS.gold);
    path.setAttribute('stroke-width', '6');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-dasharray', '14 10');
    path.classList.add('jm-path');
    svg.appendChild(path);

    // Earth & Moon anchors
    appendLabel(svg, 55, 310, '🌍', 'Earth', 36);
    appendLabel(svg, 945, 290, '🌕', 'Moon', 40);

    // Chapter nodes
    for (let level = 1; level <= CHAPTER_COUNT; level++) {
        const cfg = LEVEL_CONFIG[level];
        const t = chapterT(level);
        const pt = pathPoint(t);
        const done = isCompleted(level, snapshot.completedLevels);
        const isCurrent = level === snapshot.currentLevel && mode !== 'victory';
        const isFocus = level === focusLevel;
        const objType = cfg?.objective?.type ?? 'scan';
        const icon = OBJECTIVE_ICONS[objType];

        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('transform', `translate(${pt.x}, ${pt.y})`);
        g.style.cursor = 'pointer';

        const ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        ring.setAttribute('r', isCurrent || isFocus ? '32' : '26');
        ring.setAttribute('fill', done ? '#98FB98' : isCurrent ? '#FFFACD' : 'rgba(255,255,255,0.85)');
        ring.setAttribute('stroke', isCurrent ? '#FF69B4' : done ? '#3CB371' : '#DDA0DD');
        ring.setAttribute('stroke-width', isCurrent ? '5' : '3');
        if (isCurrent) ring.classList.add('jm-current-pulse');
        g.appendChild(ring);

        const fo = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
        fo.setAttribute('x', '-18');
        fo.setAttribute('y', '-18');
        fo.setAttribute('width', '36');
        fo.setAttribute('height', '36');
        const iconDiv = document.createElement('div');
        iconDiv.style.cssText = 'font-size:22px; text-align:center; line-height:36px; user-select:none;';
        iconDiv.textContent = icon;
        fo.appendChild(iconDiv);
        g.appendChild(fo);

        if (done) {
            const check = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            check.setAttribute('x', '14');
            check.setAttribute('y', '-14');
            check.setAttribute('font-size', '18');
            check.setAttribute('font-weight', '700');
            check.textContent = '✓';
            check.setAttribute('fill', '#2E8B57');
            check.setAttribute('stroke', '#ffffff');
            check.setAttribute('stroke-width', '0.5');
            g.appendChild(check);
        }

        const caption = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        caption.setAttribute('y', '48');
        caption.setAttribute('text-anchor', 'middle');
        caption.setAttribute('font-size', '13');
        caption.setAttribute('font-weight', '700');
        caption.setAttribute('fill', '#FFEFD5');
        caption.textContent = `Ch ${level}`;
        g.appendChild(caption);

        const sub = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        sub.setAttribute('y', '64');
        sub.setAttribute('text-anchor', 'middle');
        sub.setAttribute('font-size', '11');
        sub.setAttribute('fill', '#E6E6FA');
        sub.textContent = `${icon} ${objType}`;
        g.appendChild(sub);

        g.setAttribute('data-chapter', String(level));
        svg.appendChild(g);
    }

    stage.appendChild(svg);
    panel.appendChild(stage);
    attachPinchZoom(stage, svg);

    // Chapter detail cards
    const chapterList = document.createElement('div');
    chapterList.style.cssText = `
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        gap: 8px;
        max-height: 26vh;
        overflow-y: auto;
    `;
    for (let level = 1; level <= CHAPTER_COUNT; level++) {
        const cfg = LEVEL_CONFIG[level];
        const done = isCompleted(level, snapshot.completedLevels);
        const isCurrent = level === snapshot.currentLevel;
        const obj = cfg?.objective;
        const card = document.createElement('div');
        card.dataset.level = String(level);
        card.style.cssText = chapterCardStyle(done, isCurrent, level === focusLevel);
        card.innerHTML = `
            <div style="font-size:20px;">${OBJECTIVE_ICONS[obj?.type ?? 'scan']}${done ? ' ✅' : ''}</div>
            <div style="font-weight:800; font-size:13px; color:${COLORS.textDark};">${cfg?.name ?? `Chapter ${level}`}</div>
            <div style="font-size:11px; color:${COLORS.textLight}; margin-top:2px;">${obj?.description ?? ''}</div>
            <div style="font-size:10px; color:${COLORS.textLight}; margin-top:4px; opacity:0.9;">${BIOME_TEASERS[level] ?? ''}</div>
        `;
        chapterList.appendChild(card);
    }
    panel.appendChild(chapterList);

    // Next biome teaser
    const teaser = document.createElement('div');
    teaser.style.cssText = `
        background: rgba(255,255,255,0.65);
        border-radius: 16px;
        padding: 10px 14px;
        font-size: 14px;
        font-weight: 600;
        color: ${COLORS.textDark};
        border: 2px solid ${COLORS.white};
        text-align: center;
    `;
    teaser.textContent = biomeTeaserText(focusLevel, snapshot);
    panel.appendChild(teaser);

    // Dog reaction line
    const dogBubble = document.createElement('div');
    dogBubble.style.cssText = `
        display: flex;
        align-items: flex-start;
        gap: 10px;
        background: linear-gradient(135deg, ${COLORS.lemon}, ${COLORS.white});
        border-radius: 18px;
        padding: 12px 16px;
        border: 3px solid ${COLORS.white};
        box-shadow: 0 4px 14px ${COLORS.shadow};
        font-size: 15px;
        font-weight: 600;
        color: ${COLORS.textDark};
    `;
    const dogEmoji = document.createElement('span');
    dogEmoji.style.cssText = 'font-size:28px; line-height:1;';
    dogEmoji.textContent = '🐕';
    const dogText = document.createElement('span');
    dogText.className = 'jm-dog-text';
    dogText.textContent = dogLine;
    dogBubble.appendChild(dogEmoji);
    dogBubble.appendChild(dogText);
    panel.appendChild(dogBubble);

    const setDogLine = (line: string) => {
        dogText.textContent = line.replace(/^🐕\s*/, '');
    };

    svg.querySelectorAll('[data-chapter]').forEach((g) => {
        const level = Number((g as SVGGElement).getAttribute('data-chapter'));
        g.addEventListener('click', () => {
            setDogLine(CHAPTER_DOG_LINES[level] ?? JOURNEY_MAP_IDLE_LINE);
            teaser.textContent = biomeTeaserText(level, snapshot);
            highlightChapterCards(chapterList, level);
        });
    });

    const hint = document.createElement('p');
    hint.style.cssText = `margin:0; text-align:center; font-size:11px; color:${COLORS.textLight};`;
    hint.textContent = 'Pinch or scroll to zoom the map · tap a chapter for a dog tip';
    panel.appendChild(hint);

    root.appendChild(panel);
    document.body.appendChild(root);
    activeMap = root;

    const cleanup = () => {
        window.removeEventListener('keydown', onKey, true);
        hideJourneyMap();
        onClose?.();
    };
    const onKey = (e: KeyboardEvent) => {
        if (e.code === 'Escape') {
            e.stopPropagation();
            cleanup();
        }
    };
    window.addEventListener('keydown', onKey, true);

    root.addEventListener('click', (e) => {
        if (e.target === root) cleanup();
    });
    closeBtn.onclick = () => cleanup();

    if (autoCloseMs && autoCloseMs > 0) {
        setTimeout(() => {
            if (activeMap === root) cleanup();
        }, autoCloseMs);
    }

    return root;
}

function biomeTeaserText(focusLevel: number, snapshot: JourneyMapSnapshot): string {
    if (snapshot.completedLevels.includes(CHAPTER_COUNT)) {
        return '🌕 Next stop: moon candy picnic on the surface!';
    }
    const nextLevel = Math.min(
        CHAPTER_COUNT,
        Math.max(
            focusLevel + (isCompleted(focusLevel, snapshot.completedLevels) ? 1 : 0),
            snapshot.currentLevel + (isCompleted(snapshot.currentLevel, snapshot.completedLevels) ? 1 : 0),
            Math.min(CHAPTER_COUNT, snapshot.currentLevel + 1)
        )
    );
    // Prefer the chapter after the focused one when it is complete
    let tease = focusLevel;
    if (isCompleted(focusLevel, snapshot.completedLevels) && focusLevel < CHAPTER_COUNT) {
        tease = focusLevel + 1;
    } else if (focusLevel < CHAPTER_COUNT) {
        tease = Math.max(focusLevel, Math.min(nextLevel, CHAPTER_COUNT));
    } else {
        tease = CHAPTER_COUNT;
    }
    const name = LEVEL_CONFIG[tease]?.name ?? `Chapter ${tease}`;
    if (tease === focusLevel && !isCompleted(focusLevel, snapshot.completedLevels)) {
        return `📍 Now exploring: ${name} — ${BIOME_TEASERS[tease] ?? 'new wonders!'}`;
    }
    return `✨ Coming up: ${name} — ${BIOME_TEASERS[tease] ?? 'new wonders ahead!'}`;
}

function highlightChapterCards(list: HTMLDivElement, level: number): void {
    list.querySelectorAll('[data-level]').forEach((el) => {
        const card = el as HTMLDivElement;
        const L = Number(card.dataset.level);
        const done = card.textContent?.includes('✅') ?? false;
        card.style.outline = L === level ? `3px solid ${COLORS.pinkDark}` : 'none';
        card.style.transform = L === level ? 'scale(1.03)' : 'scale(1)';
        void done;
    });
}

function chapterCardStyle(done: boolean, isCurrent: boolean, isFocus: boolean): string {
    const bg = done
        ? 'linear-gradient(135deg, #c8f7c5, #ffffff)'
        : isCurrent
            ? `linear-gradient(135deg, ${COLORS.lemon}, ${COLORS.pinkLight})`
            : 'rgba(255,255,255,0.7)';
    return `
        background: ${bg};
        border-radius: 14px;
        padding: 10px;
        border: 2px solid ${isFocus || isCurrent ? COLORS.pinkDark : COLORS.white};
        box-shadow: 0 3px 10px ${COLORS.shadow};
        ${isCurrent ? 'animation: hud-pulse 1.4s ease-in-out infinite;' : ''}
    `;
}

function statChip(label: string, value: string): string {
    return `
        <div style="
            background: rgba(255,255,255,0.75);
            border: 2px solid ${COLORS.white};
            border-radius: 999px;
            padding: 6px 14px;
            font-size: 13px;
            font-weight: 700;
            color: ${COLORS.textDark};
            box-shadow: 0 2px 8px ${COLORS.shadow};
        ">${label}: <span style="color:${COLORS.pinkDark}">${value}</span></div>
    `;
}

function menuBtnStyle(color: string): string {
    return `
        padding: 10px 18px;
        font-size: 15px;
        font-weight: bold;
        background: linear-gradient(135deg, ${color}, ${COLORS.white});
        border: 3px solid ${COLORS.white};
        border-radius: 16px;
        color: ${COLORS.textDark};
        cursor: pointer;
        box-shadow: 0 4px 12px ${COLORS.shadow};
        font-family: inherit;
        flex-shrink: 0;
    `;
}

function quadraticPath(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number): string {
    return `M ${x0} ${y0} Q ${x1} ${y1} ${x2} ${y2}`;
}

function appendLabel(
    svg: SVGSVGElement,
    x: number,
    y: number,
    emoji: string,
    label: string,
    size: number
): void {
    const fo = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
    fo.setAttribute('x', String(x - 40));
    fo.setAttribute('y', String(y - 40));
    fo.setAttribute('width', '80');
    fo.setAttribute('height', '80');
    const div = document.createElement('div');
    div.style.cssText = 'text-align:center; user-select:none;';
    div.innerHTML = `<div style="font-size:${size}px; line-height:1;">${emoji}</div>
        <div style="font-size:12px; font-weight:700; color:#FFEFD5; text-shadow:0 1px 2px #000;">${label}</div>`;
    fo.appendChild(div);
    svg.appendChild(fo);
}

function injectJourneyMapStyles(): void {
    if (document.getElementById('journey-map-styles')) return;
    const style = document.createElement('style');
    style.id = 'journey-map-styles';
    style.textContent = `
        .jm-stars { position:absolute; inset:0; pointer-events:none; overflow:hidden; }
        @keyframes jm-twinkle {
            0%, 100% { opacity: 0.35; transform: scale(1); }
            50% { opacity: 1; transform: scale(1.4); }
        }
        .jm-path {
            stroke-dashoffset: 0;
            animation: jm-dash 18s linear infinite;
        }
        @keyframes jm-dash {
            to { stroke-dashoffset: -240; }
        }
        .jm-current-pulse {
            animation: jm-ring 1.2s ease-in-out infinite;
        }
        @keyframes jm-ring {
            0%, 100% { stroke-width: 5; opacity: 1; }
            50% { stroke-width: 8; opacity: 0.85; }
        }
    `;
    document.head.appendChild(style);
}

/** Optional pinch / wheel zoom on the SVG map stage. */
function attachPinchZoom(stage: HTMLDivElement, svg: SVGSVGElement): void {
    let scale = 1;
    let tx = 0;
    let ty = 0;
    let pointers = new Map<number, { x: number; y: number }>();
    let lastPinchDist = 0;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;

    const apply = () => {
        scale = Math.min(2.5, Math.max(1, scale));
        if (scale === 1) {
            tx = 0;
            ty = 0;
        }
        svg.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
    };

    stage.addEventListener(
        'wheel',
        (e) => {
            e.preventDefault();
            scale *= e.deltaY < 0 ? 1.08 : 0.92;
            apply();
        },
        { passive: false }
    );

    stage.addEventListener('pointerdown', (e) => {
        stage.setPointerCapture(e.pointerId);
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pointers.size === 1) {
            dragging = true;
            lastX = e.clientX;
            lastY = e.clientY;
            stage.style.cursor = 'grabbing';
        } else if (pointers.size === 2) {
            dragging = false;
            const pts = [...pointers.values()];
            lastPinchDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        }
    });

    stage.addEventListener('pointermove', (e) => {
        if (!pointers.has(e.pointerId)) return;
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

        if (pointers.size === 2) {
            const pts = [...pointers.values()];
            const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
            if (lastPinchDist > 0) {
                scale *= dist / lastPinchDist;
                apply();
            }
            lastPinchDist = dist;
            return;
        }

        if (dragging && scale > 1) {
            tx += e.clientX - lastX;
            ty += e.clientY - lastY;
            lastX = e.clientX;
            lastY = e.clientY;
            apply();
        }
    });

    const endPointer = (e: PointerEvent) => {
        pointers.delete(e.pointerId);
        if (pointers.size < 2) lastPinchDist = 0;
        if (pointers.size === 0) {
            dragging = false;
            stage.style.cursor = 'grab';
        }
    };
    stage.addEventListener('pointerup', endPointer);
    stage.addEventListener('pointercancel', endPointer);
}

/**
 * Mark a chapter complete in save progress (unlocks the next level).
 * Safe to call repeatedly.
 */
export function recordChapterComplete(saveManager: SaveManager, level: number): void {
    if (level < 1 || level > CHAPTER_COUNT) return;
    const unlocked = saveManager.getUnlockedLevels();
    saveManager.unlockLevel(level);
    if (level < CHAPTER_COUNT) {
        saveManager.unlockLevel(level + 1);
    } else {
        const firstFullClear = !unlocked.includes(7);
        saveManager.unlockLevel(7);
        if (firstFullClear) {
            saveManager.recordRunCompleted();
        }
    }
}
