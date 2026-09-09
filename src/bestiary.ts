import { SaveManager } from './save_manager';
import { BESTIARY_ENTRIES } from './bestiary_data';

export type { BestiaryEntryId, BestiaryEntry } from './bestiary_data';
export { BESTIARY_ENTRIES } from './bestiary_data';

/** Renders the bestiary entry grid (cataloged + locked silhouettes). Shared by the modal and the hub. */
export function createBestiaryGrid(saveManager: SaveManager): HTMLDivElement {
    const cataloged = new Set(saveManager.getCatalogedCreatures());

    const grid = document.createElement('div');
    grid.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; max-width: 720px; width: 90%; max-height: 55vh; overflow-y: auto; padding: 4px;';

    for (const entry of Object.values(BESTIARY_ENTRIES)) {
        const known = cataloged.has(entry.id);
        const el = document.createElement('div');
        el.style.cssText = `
            background: rgba(255,255,255,0.08);
            padding: 14px;
            border-radius: 10px;
            border: 2px solid ${known ? '#44ddaa' : '#444'};
            opacity: ${known ? 1 : 0.55};
        `;
        el.innerHTML = `
            <div style="font-size: 2em; margin-bottom: 4px;">${known ? entry.icon : '❓'}</div>
            <div style="font-weight: bold; font-size: 1.05em; margin-bottom: 4px; color: white;">${known ? entry.name : '???'}</div>
            <div style="font-size: 0.85em; color: #ccc; margin-bottom: 6px;">${known ? entry.flavor : 'Not yet cataloged. ' + entry.howTo}</div>
            ${known ? `<div style="font-size: 0.8em; color: #88ffcc;">${entry.memoryDesc}</div>` : ''}
        `;
        grid.appendChild(el);
    }

    return grid;
}

/** Renders the "Weird Life Log" bestiary modal. Caller is responsible for appending/removing it. */
export function createBestiaryUI(saveManager: SaveManager, onClose: () => void): HTMLDivElement {
    const cataloged = new Set(saveManager.getCatalogedCreatures());
    const container = document.createElement('div');
    container.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(10, 10, 20, 0.95);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        font-family: 'Segoe UI', sans-serif;
        color: white;
    `;

    const total = Object.keys(BESTIARY_ENTRIES).length;
    container.innerHTML = `
        <h1 style="font-size: 2.4em; margin-bottom: 4px; color: #aaffee; text-shadow: 0 0 20px rgba(170,255,238,0.5);">
            \u{1F4D6} Weird Life Log
        </h1>
        <p style="font-size: 1.1em; color: #88ccff; margin-bottom: 20px;">
            ${cataloged.size} / ${total} creatures cataloged
        </p>
        <button id="close-bestiary" style="margin-top: 24px; padding: 12px 36px; font-size: 1.1em; background: #444; color: white; border: none; border-radius: 8px; cursor: pointer;">
            Close
        </button>
    `;

    const closeBtn = container.querySelector('#close-bestiary')!;
    container.insertBefore(createBestiaryGrid(saveManager), closeBtn);

    closeBtn.addEventListener('click', () => {
        container.remove();
        onClose();
    });

    return container;
}
