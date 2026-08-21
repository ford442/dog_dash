import test from 'node:test';
import assert from 'node:assert/strict';

test('AudioPort mock handles sequence and preset callbacks', () => {
    const played = [];
    const mockAudio = {
        play: (type, vol) => played.push({ type, vol }),
        playSequence: (seq) => seq.forEach(s => played.push({ type: s.sound, vol: s.volume })),
        playSealClap: () => played.push({ type: 'seal_clap' }),
        playCrystalChime: (notes) => played.push({ type: 'crystal_chime', notes }),
        playMagicSound: (type) => played.push({ type: `magic_${type}` })
    };

    mockAudio.play('twinkle', 0.8);
    mockAudio.playSequence([{ sound: 'twinkle', delay: 0 }, { sound: 'heart_pop', delay: 0.1 }]);
    mockAudio.playSealClap();
    mockAudio.playCrystalChime([440, 554, 659]);
    mockAudio.playMagicSound('collect');

    assert.equal(played.length, 6);
    assert.equal(played[0].type, 'twinkle');
    assert.equal(played[3].type, 'seal_clap');
    assert.deepEqual(played[4].notes, [440, 554, 659]);
    assert.equal(played[5].type, 'magic_collect');
});

test('InventoryPort records materials correctly', () => {
    const inventory = new Map();
    const mockInventory = {
        addMaterial: (id, amount) => {
            const current = inventory.get(id) ?? 0;
            const updated = current + amount;
            inventory.set(id, updated);
            return updated;
        },
        getMaterialCount: (id) => inventory.get(id) ?? 0
    };

    assert.equal(mockInventory.getMaterialCount('luminousDust'), 0);
    assert.equal(mockInventory.addMaterial('luminousDust', 5), 5);
    assert.equal(mockInventory.addMaterial('luminousDust', 3), 8);
    assert.equal(mockInventory.getMaterialCount('luminousDust'), 8);
});

test('PlayerMotionPort updates speeds and origins', () => {
    let scrollSpeed = 5;
    let worldOriginY = 0;
    let playerNudge = { x: 0, y: 0 };

    const mockMotion = {
        getScrollSpeed: () => scrollSpeed,
        setScrollSpeed: (s) => { scrollSpeed = s; },
        setWorldOriginY: (y) => { worldOriginY = y; },
        nudgePlayer: (dx, dy) => {
            playerNudge.x += dx;
            playerNudge.y += dy;
        }
    };

    assert.equal(mockMotion.getScrollSpeed(), 5);
    mockMotion.setScrollSpeed(0);
    assert.equal(mockMotion.getScrollSpeed(), 0);
    mockMotion.setWorldOriginY(120);
    assert.equal(worldOriginY, 120);
    mockMotion.nudgePlayer(10, -5);
    assert.deepEqual(playerNudge, { x: 10, y: -5 });
});

test('CollisionPort WASM memory handle contract', () => {
    let mem = new Float32Array(1024);
    const wasmHandle = {
        exports: null,
        memory: mem
    };
    const mockCollision = {
        getWasm: () => wasmHandle,
        setWasmMemory: (m) => { wasmHandle.memory = m; }
    };

    assert.equal(mockCollision.getWasm().memory?.length, 1024);
    mockCollision.setWasmMemory(null);
    assert.equal(mockCollision.getWasm().memory, null);
});
