/**
 * Moon Journey Map — kid-friendly 2D SVG/DOM overlay.
 */

import { LEVEL_CONFIG, type LevelObjectiveType } from '../level_config';
import type { SaveManager } from '../save_manager';
import { BESTIARY_ENTRIES } from '../bestiary_data';
import { SPECIES_NAMES } from '../discovery_system';
import { COLORS } from '../hud_system/styles';
import {
    CHAPTER_DOG_LINES,
    JOURNEY_MAP_IDLE_LINE,
    getChapterCompleteLine,
    getChapterDogLine
} from '../dog_cockpit/chapter_lines';
import type { JourneyMapMode, JourneyMapSnapshot, ShowJourneyMapOptions } from './types';
import {
    OBJECTIVE_ICONS,
    BIOME_TEASERS,
    CHAPTER_COUNT,
    pathPoint,
    chapterT,
    isCompleted,
    createJourneyMapSnapshot
} from './data';

export { createJourneyMapSnapshot } from './data';

import {
    biomeTeaserText,
    highlightChapterCards,
    chapterCardStyle,
    statChip,
    menuBtnStyle,
    quadraticPath,
    appendLabel,
    injectJourneyMapStyles,
    attachPinchZoom
} from './chrome';

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

    const { mode, completedChapter, onClose, autoCloseMs } = options;
    const snapshot: JourneyMapSnapshot = {
        ...options.snapshot,
        completedLevels: [...options.snapshot.completedLevels]
    };

    // Victory mode: every chapter is completed for display.
    if (mode === 'victory') {
        for (let L = 1; L <= CHAPTER_COUNT; L++) {
            if (!snapshot.completedLevels.includes(L)) snapshot.completedLevels.push(L);
        }
        snapshot.completedLevels.sort((a, b) => a - b);
        snapshot.currentLevel = CHAPTER_COUNT;
    }

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
        grid-template-columns: repeat(6, minmax(0, 1fr));
        gap: 8px;
        overflow-x: auto;
    `;
    if (window.matchMedia('(max-width: 900px)').matches) {
        chapterList.style.gridTemplateColumns = 'repeat(auto-fit, minmax(130px, 1fr))';
        chapterList.style.maxHeight = '28vh';
        chapterList.style.overflowY = 'auto';
    }
    for (let level = 1; level <= CHAPTER_COUNT; level++) {
        const cfg = LEVEL_CONFIG[level];
        const done = isCompleted(level, snapshot.completedLevels);
        const isCurrent = level === snapshot.currentLevel;
        const obj = cfg?.objective;
        const card = document.createElement('div');
        card.dataset.level = String(level);
        card.style.cssText = chapterCardStyle(done, isCurrent, level === focusLevel);
        card.innerHTML = `
            <div style="font-size:18px;">${OBJECTIVE_ICONS[obj?.type ?? 'scan']}${done ? ' ✅' : ''}</div>
            <div style="font-weight:800; font-size:12px; color:${COLORS.textDark}; line-height:1.2;">${cfg?.name ?? `Chapter ${level}`}</div>
            <div style="font-size:10px; color:${COLORS.textLight}; margin-top:2px; line-height:1.25;">${obj?.description ?? ''}</div>
            <div style="font-size:9px; color:${COLORS.textLight}; margin-top:4px; opacity:0.9; line-height:1.2;">${BIOME_TEASERS[level] ?? ''}</div>
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

