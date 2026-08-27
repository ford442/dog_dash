import { strict as assert } from 'node:assert';
import { test, beforeEach } from 'node:test';

/**
 * Minimal localStorage shim — SaveManager persists through it, so without one
 * this test would exercise the in-memory path only.
 */
class MemoryStorage {
    private store = new Map<string, string>();
    getItem(key: string): string | null { return this.store.get(key) ?? null; }
    setItem(key: string, value: string): void { this.store.set(key, value); }
    removeItem(key: string): void { this.store.delete(key); }
    clear(): void { this.store.clear(); }
}

(globalThis as { localStorage?: unknown }).localStorage = new MemoryStorage();

const { SaveManager, DEFAULT_AUDIO_SETTINGS } = await import('../../src/save_manager');

beforeEach(() => {
    (globalThis as { localStorage: MemoryStorage }).localStorage.clear();
});

test('a fresh save carries the default audio settings', () => {
    const manager = new SaveManager();
    assert.deepEqual(manager.getAudioSettings(), DEFAULT_AUDIO_SETTINGS);
});

test('audio settings survive a reload', () => {
    const first = new SaveManager();
    first.setAudioSettings({ master: 0.4, music: 0.25, sfx: 0.9, reducedAudio: true });

    const reloaded = new SaveManager();
    assert.deepEqual(reloaded.getAudioSettings(), {
        master: 0.4,
        music: 0.25,
        sfx: 0.9,
        reducedAudio: true
    });
});

test('partial updates merge instead of replacing', () => {
    const manager = new SaveManager();
    manager.setAudioSettings({ music: 0.1 });

    const settings = manager.getAudioSettings();
    assert.equal(settings.music, 0.1);
    assert.equal(settings.master, DEFAULT_AUDIO_SETTINGS.master);
    assert.equal(settings.sfx, DEFAULT_AUDIO_SETTINGS.sfx);
});

test('levels are clamped into 0..1 and junk falls back to defaults', () => {
    const manager = new SaveManager();

    const clamped = manager.setAudioSettings({ master: 5, music: -2 });
    assert.equal(clamped.master, 1);
    assert.equal(clamped.music, 0);

    const junk = manager.setAudioSettings({ sfx: Number.NaN });
    assert.equal(junk.sfx, DEFAULT_AUDIO_SETTINGS.sfx);
});

test('a save file predating audio settings gains the defaults', () => {
    const storage = (globalThis as { localStorage: MemoryStorage }).localStorage;
    storage.setItem('dog_dash_save_v1', JSON.stringify({
        cores: 42,
        unlockedLevels: [1, 2, 3],
        version: '1.0'
    }));

    const manager = new SaveManager();
    assert.deepEqual(manager.getAudioSettings(), DEFAULT_AUDIO_SETTINGS);
    // Existing progress must not be disturbed by the migration.
    assert.equal(manager.getCores(), 42);
});

test('getAudioSettings hands back a copy, not the live object', () => {
    const manager = new SaveManager();
    const settings = manager.getAudioSettings();
    settings.master = 0.01;
    assert.equal(manager.getAudioSettings().master, DEFAULT_AUDIO_SETTINGS.master);
});
