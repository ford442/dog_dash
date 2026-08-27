/**
 * DebugSystem - FPS counter and graphics feature toggles
 * Provides a hotkey-toggled overlay with FPS stats and checkboxes
 * to enable/disable individual visual systems.
 */

export class DebugSystem {
    // FPS tracking
    private frameTimes: number[] = [];
    private readonly maxFrameHistory = 120;
    private fpsCurrent = 0;
    private fpsMin = Infinity;
    private fpsMax = 0;
    private fpsAvg = 0;
    private elapsedSinceRefresh = 0;
    private readonly refreshInterval = 0.25; // update display every 0.25s

    // Toggles
    private systems = new Map<string, { label: string; enabled: boolean }>();

    // DOM
    private overlay: HTMLDivElement | null = null;
    private panel: HTMLDivElement | null = null;
    private panelVisible = false;
    private systemsContainer: HTMLDivElement | null = null;
    private customSectionContainer: HTMLDivElement | null = null;
    private rendererInfo: string = '';
    private rendererInfoElement: HTMLDivElement | null = null;
    private visibilityListeners: Array<(visible: boolean) => void> = [];

    constructor() {
        this.createOverlay();
        this.createPanel();
        this.setupHotkeys();
    }

    // ========================================================================
    // Registration
    // ========================================================================

    register(name: string, label: string, enabled = true): void {
        this.systems.set(name, { label, enabled });
        this.addPanelRow(name, label, enabled);
    }

    isEnabled(name: string): boolean {
        const sys = this.systems.get(name);
        return sys ? sys.enabled : true;
    }

    toggle(name: string): void {
        const sys = this.systems.get(name);
        if (sys) {
            sys.enabled = !sys.enabled;
            this.updatePanelCheckbox(name, sys.enabled);
        }
    }

    setEnabled(name: string, value: boolean): void {
        const sys = this.systems.get(name);
        if (sys) {
            sys.enabled = value;
            this.updatePanelCheckbox(name, value);
        }
    }

    isVisible(): boolean {
        return this.panelVisible;
    }

    onVisibilityChange(listener: (visible: boolean) => void): void {
        this.visibilityListeners.push(listener);
    }

    getCustomSectionContainer(): HTMLDivElement {
        if (!this.customSectionContainer) {
            throw new Error('DebugSystem panel not initialized');
        }
        return this.customSectionContainer;
    }

    setRendererInfo(backend: string, requestedBackend: string, fallbackReason?: string): void {
        this.rendererInfo = `renderer: ${backend}${backend !== requestedBackend ? ` (requested ${requestedBackend})` : ''}`;
        if (fallbackReason) {
            this.rendererInfo += `\n${fallbackReason}`;
        }
        this.updateRendererInfoElement();
        this.updateOverlayText();
    }

    // ========================================================================
    // Update / FPS
    // ========================================================================

    update(delta: number): void {
        // delta is in seconds
        if (delta > 0) {
            this.frameTimes.push(delta);
            if (this.frameTimes.length > this.maxFrameHistory) {
                this.frameTimes.shift();
            }
        }

        this.elapsedSinceRefresh += delta;
        if (this.elapsedSinceRefresh >= this.refreshInterval) {
            this.elapsedSinceRefresh = 0;
            this.computeFps();
            this.updateOverlayText();
        }
    }

    private computeFps(): void {
        if (this.frameTimes.length === 0) return;

        let total = 0;
        let min = Infinity;
        let max = 0;

        for (const dt of this.frameTimes) {
            const fps = 1 / dt;
            total += fps;
            if (fps < min) min = fps;
            if (fps > max) max = fps;
        }

        this.fpsCurrent = 1 / this.frameTimes[this.frameTimes.length - 1];
        this.fpsMin = min;
        this.fpsMax = max;
        this.fpsAvg = total / this.frameTimes.length;
    }

    // ========================================================================
    // UI
    // ========================================================================

    private createOverlay(): void {
        this.overlay = document.createElement('div');
        this.overlay.style.cssText = `
            position: fixed;
            top: 8px;
            right: 8px;
            font-family: monospace;
            font-size: 13px;
            color: #0f0;
            background: rgba(0,0,0,0.7);
            padding: 6px 10px;
            border-radius: 4px;
            z-index: 9999;
            pointer-events: none;
            display: none;
            white-space: pre;
            line-height: 1.4;
        `;
        this.overlay.textContent = 'FPS: --';
        document.body.appendChild(this.overlay);
    }

    private updateOverlayText(): void {
        if (!this.overlay) return;
        const cur = Math.round(this.fpsCurrent);
        const mn = Math.round(this.fpsMin);
        const mx = Math.round(this.fpsMax);
        const av = Math.round(this.fpsAvg);
        const rendererLine = this.rendererInfo ? `\n${this.rendererInfo}` : '';
        this.overlay.textContent = `FPS: ${cur}\nmin: ${mn}  max: ${mx}  avg: ${av}${rendererLine}`;
    }

    private createPanel(): void {
        this.panel = document.createElement('div');
        this.panel.style.cssText = `
            position: fixed;
            top: 8px;
            left: 50%;
            transform: translateX(-50%);
            max-height: 80vh;
            overflow-y: auto;
            background: rgba(0,0,0,0.85);
            color: #fff;
            font-family: sans-serif;
            font-size: 12px;
            padding: 10px 14px;
            border-radius: 6px;
            z-index: 9998;
            display: none;
            flex-direction: column;
            gap: 4px;
            min-width: 220px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.5);
        `;

        const header = document.createElement('div');
        header.style.cssText = `
            font-weight: bold;
            font-size: 13px;
            margin-bottom: 6px;
            border-bottom: 1px solid rgba(255,255,255,0.2);
            padding-bottom: 4px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        `;
        header.innerHTML = `<span>Debug Systems</span><span style="color:#888;font-size:11px;">\` toggle</span>`;
        this.panel.appendChild(header);

        this.rendererInfoElement = document.createElement('div');
        this.rendererInfoElement.style.cssText = `
            color: #9fdcff;
            font-family: monospace;
            font-size: 11px;
            white-space: pre-wrap;
            margin-bottom: 6px;
            padding-bottom: 6px;
            border-bottom: 1px solid rgba(255,255,255,0.12);
            display: none;
        `;
        this.panel.appendChild(this.rendererInfoElement);

        this.systemsContainer = document.createElement('div');
        this.systemsContainer.style.display = 'flex';
        this.systemsContainer.style.flexDirection = 'column';
        this.systemsContainer.style.gap = '3px';
        this.panel.appendChild(this.systemsContainer);

        // Add a "Disable All" / "Enable All" row
        const bulkRow = document.createElement('div');
        bulkRow.style.cssText = `
            display: flex;
            gap: 6px;
            margin-top: 6px;
            padding-top: 4px;
            border-top: 1px solid rgba(255,255,255,0.15);
        `;
        const disableAll = document.createElement('button');
        disableAll.textContent = 'Disable All';
        disableAll.style.cssText = this.bulkBtnStyle();
        disableAll.onclick = () => this.setAll(false);
        const enableAll = document.createElement('button');
        enableAll.textContent = 'Enable All';
        enableAll.style.cssText = this.bulkBtnStyle();
        enableAll.onclick = () => this.setAll(true);
        bulkRow.appendChild(disableAll);
        bulkRow.appendChild(enableAll);
        this.panel.appendChild(bulkRow);

        this.customSectionContainer = document.createElement('div');
        this.panel.appendChild(this.customSectionContainer);

        document.body.appendChild(this.panel);
    }

    /** Chapter music profile currently playing (debug breadcrumb). */
    getMusicProfileId(): string | null {
        return typeof window !== 'undefined' ? (window.currentMusicProfileId ?? null) : null;
    }

    private updateRendererInfoElement(): void {
        if (!this.rendererInfoElement) return;
        this.rendererInfoElement.textContent = this.rendererInfo;
        this.rendererInfoElement.style.display = this.rendererInfo ? 'block' : 'none';
    }

    private bulkBtnStyle(): string {
        return `
            flex: 1;
            background: rgba(255,255,255,0.1);
            color: #fff;
            border: 1px solid rgba(255,255,255,0.2);
            border-radius: 3px;
            padding: 4px 6px;
            font-size: 11px;
            cursor: pointer;
        `;
    }

    private addPanelRow(name: string, label: string, enabled: boolean): void {
        if (!this.systemsContainer) return;

        const row = document.createElement('label');
        row.style.cssText = `
            display: flex;
            align-items: center;
            gap: 6px;
            cursor: pointer;
            padding: 2px 4px;
            border-radius: 3px;
            transition: background 0.1s;
        `;
        row.onmouseenter = () => { row.style.background = 'rgba(255,255,255,0.1)'; };
        row.onmouseleave = () => { row.style.background = 'transparent'; };

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = enabled;
        checkbox.dataset.system = name;
        checkbox.style.cursor = 'pointer';
        checkbox.addEventListener('change', () => {
            this.setEnabled(name, checkbox.checked);
        });

        const text = document.createElement('span');
        text.textContent = label;
        text.style.flex = '1';

        row.appendChild(checkbox);
        row.appendChild(text);
        this.systemsContainer.appendChild(row);
    }

    private updatePanelCheckbox(name: string, enabled: boolean): void {
        if (!this.systemsContainer) return;
        const cb = this.systemsContainer.querySelector(`input[data-system="${name}"]`) as HTMLInputElement | null;
        if (cb) cb.checked = enabled;
    }

    private setAll(value: boolean): void {
        for (const [name, sys] of this.systems) {
            sys.enabled = value;
            this.updatePanelCheckbox(name, value);
        }
    }

    // ========================================================================
    // Visibility
    // ========================================================================

    show(): void {
        this.panelVisible = true;
        if (this.overlay) this.overlay.style.display = 'block';
        if (this.panel) this.panel.style.display = 'flex';
        this._notifyVisibility(true);
    }

    hide(): void {
        this.panelVisible = false;
        if (this.overlay) this.overlay.style.display = 'none';
        if (this.panel) this.panel.style.display = 'none';
        this._notifyVisibility(false);
    }

    private _notifyVisibility(visible: boolean): void {
        for (const listener of this.visibilityListeners) listener(visible);
    }

    toggleVisibility(): void {
        if (this.panelVisible) this.hide();
        else this.show();
    }

    // ========================================================================
    // Hotkeys
    // ========================================================================

    private setupHotkeys(): void {
        window.addEventListener('keydown', (e) => {
            if (e.code === 'Backquote') {
                e.preventDefault();
                this.toggleVisibility();
            }
        });
    }
}
