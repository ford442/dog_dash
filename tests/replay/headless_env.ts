/**
 * Minimal browser globals for booting the real Dog Dash composition root in
 * Node. Nothing here renders: DOM nodes are inert recursive proxies, `fetch`
 * serves only the shipping WASM out of `public/` (so collision runs on the
 * real AssemblyScript backend), and every other asset request fails — which
 * makes `player_loader.ts` take its placeholder-rocket path, exactly as it
 * does in a browser when rocket.glb 404s.
 *
 * Must be installed before any `src/` module is imported (several read
 * `document` / `window` at import time).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const PUBLIC_DIR = fileURLToPath(new URL('../../public/', import.meta.url));

/** An inert stand-in for any DOM node / canvas / 2D context: every property is another one. */
function inertNode(): unknown {
    const target = function inert() {} as unknown as Record<PropertyKey, unknown>;
    return new Proxy(target, {
        get(t, prop) {
            if (prop in t) return t[prop];
            if (prop === Symbol.toPrimitive) return () => '';
            if (prop === Symbol.iterator) return function* () {};
            // Never look like a thenable, or `await node` would hang.
            if (prop === 'then') return undefined;
            if (prop === 'length' || prop === 'width' || prop === 'height') return 0;
            const child = inertNode();
            t[prop] = child;
            return child;
        },
        set(t, prop, value) {
            t[prop] = value;
            return true;
        },
        apply() {
            return inertNode();
        },
        construct() {
            return inertNode() as object;
        }
    });
}

class MemoryStorage {
    private readonly map = new Map<string, string>();
    getItem(key: string): string | null {
        return this.map.has(key) ? this.map.get(key)! : null;
    }
    setItem(key: string, value: string): void {
        this.map.set(key, String(value));
    }
    removeItem(key: string): void {
        this.map.delete(key);
    }
    clear(): void {
        this.map.clear();
    }
    key(i: number): string | null {
        return [...this.map.keys()][i] ?? null;
    }
    get length(): number {
        return this.map.size;
    }
}

let installed = false;

export function installHeadlessEnv(): void {
    if (installed) return;
    installed = true;
    const g = globalThis as Record<string, unknown>;

    g.document = inertNode();
    g.window = globalThis;
    g.innerWidth = 1280;
    g.innerHeight = 720;
    g.devicePixelRatio = 1;
    g.isSecureContext = false;
    g.location = { search: '', href: 'http://headless.local/', hostname: 'headless.local', reload() {} };
    g.localStorage = new MemoryStorage();
    g.sessionStorage = new MemoryStorage();
    g.addEventListener = () => {};
    g.removeEventListener = () => {};
    g.dispatchEvent = () => true;
    // No frames are ever drawn; anything scheduling one simply never runs.
    g.requestAnimationFrame = () => 0;
    g.cancelAnimationFrame = () => {};
    g.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
    g.Image = class { addEventListener() {} removeEventListener() {} };
    g.HTMLCanvasElement = class {};
    g.HTMLElement = class {};
    g.HTMLDivElement = class {};
    g.AudioContext = undefined;
    g.webkitAudioContext = undefined;
    try {
        Object.defineProperty(globalThis, 'navigator', {
            value: { userAgent: 'node-headless-replay', maxTouchPoints: 0, gpu: undefined },
            configurable: true,
            writable: true
        });
    } catch { /* read-only navigator on some Node builds — the real one is fine */ }

    // Relative URLs (three's FileLoader) need a Request that accepts them.
    g.Request = class {
        readonly url: string;
        constructor(url: string) { this.url = String(url); }
    };
    g.fetch = async (input: unknown) => {
        const url = typeof input === 'string' ? input : (input as { url: string }).url;
        if (url.endsWith('.wasm')) {
            const rel = url.replace(/^\.?\//, '');
            const bytes = readFileSync(join(PUBLIC_DIR, rel));
            return new Response(bytes, { status: 200, headers: { 'Content-Type': 'application/wasm' } });
        }
        throw new Error(`[headless] no network: ${url}`);
    };
}
