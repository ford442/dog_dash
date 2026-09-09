/**
 * Journey map DOM helpers (cards, styles, pinch-zoom).
 */

import { LEVEL_CONFIG } from '../level_config';
import { COLORS } from '../hud_system/styles';
import type { JourneyMapSnapshot } from './types';
import { BIOME_TEASERS, CHAPTER_COUNT, isCompleted } from './data';

export function biomeTeaserText(focusLevel: number, snapshot: JourneyMapSnapshot): string {
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

export function highlightChapterCards(list: HTMLDivElement, level: number): void {
    list.querySelectorAll('[data-level]').forEach((el) => {
        const card = el as HTMLDivElement;
        const L = Number(card.dataset.level);
        const done = card.textContent?.includes('✅') ?? false;
        card.style.outline = L === level ? `3px solid ${COLORS.pinkDark}` : 'none';
        card.style.transform = L === level ? 'scale(1.03)' : 'scale(1)';
        void done;
    });
}

export function chapterCardStyle(done: boolean, isCurrent: boolean, isFocus: boolean): string {
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

export function statChip(label: string, value: string): string {
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

export function menuBtnStyle(color: string): string {
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

export function quadraticPath(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number): string {
    return `M ${x0} ${y0} Q ${x1} ${y1} ${x2} ${y2}`;
}

export function appendLabel(
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

export function injectJourneyMapStyles(): void {
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
export function attachPinchZoom(stage: HTMLDivElement, svg: SVGSVGElement): void {
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
