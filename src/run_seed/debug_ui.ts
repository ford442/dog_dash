/**
 * Debug panel section for active run seed (copy).
 */

import { serializeRunSeed } from './codec';
import { tryGetRunSeed } from './run_context';

export function attachRunSeedDebugSection(container: HTMLDivElement): void {
    const heading = document.createElement('div');
    heading.textContent = 'Run Seed';
    heading.style.cssText = 'font-weight:bold; margin:8px 0 4px 0; color:#ccc; font-size:12px;';
    container.appendChild(heading);

    const seedRow = document.createElement('div');
    seedRow.style.cssText = 'font-size:11px; color:#aaa; word-break:break-all; margin-bottom:6px;';
    container.appendChild(seedRow);

    const copyBtn = document.createElement('button');
    copyBtn.textContent = 'Copy seed';
    copyBtn.style.cssText = `
        font-size:11px; padding:4px 8px; cursor:pointer;
        background:#333; color:#eee; border:1px solid #555; border-radius:4px;
    `;
    copyBtn.addEventListener('click', () => {
        const seed = tryGetRunSeed();
        if (!seed) return;
        const text = serializeRunSeed(seed);
        if (navigator.clipboard?.writeText) {
            void navigator.clipboard.writeText(text);
        } else {
            const ta = document.createElement('textarea');
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            ta.remove();
        }
        copyBtn.textContent = 'Copied!';
        setTimeout(() => { copyBtn.textContent = 'Copy seed'; }, 1500);
    });
    container.appendChild(copyBtn);

    const refresh = () => {
        const seed = tryGetRunSeed();
        seedRow.textContent = seed
            ? `${seed.campaignId} · ${serializeRunSeed(seed)}`
            : '(no active run)';
    };
    refresh();
    setInterval(refresh, 2000);
}
