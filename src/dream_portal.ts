/**
 * Dream Portal Doors — secret cloud doorways that drop the player into a short
 * bonus "dream room" and hand them back to the main run afterwards.
 *
 * How the pocket works
 * --------------------
 * The dream room is not a second scene: it is a pocket of the same scene parked
 * far above the playfield (`DREAM_ROOM_Y`). Entering teleports the player up
 * there, parks `autoScrollSpeed` at 0 and raises the player's vertical clamp
 * origin (`playerState.worldOriginY`), so the LevelManager stream, obstacle
 * spawner and orb cleanup — all keyed off camera/player X — simply stop
 * advancing. Exiting restores Y, the clamp origin and the scroll speed, so the
 * main run resumes exactly where it paused. No level state is torn down, which
 * is what keeps hub → continue → portal → exit → hub coherent.
 *
 * Rewards deliberately reuse existing systems (star orbs via `OrbManager`, cores
 * via `SaveManager`, scan targets via `DiscoveryManager`) — no parallel economy.
 *
 * Deferred-loaded via `level_systems_loader` when a level declares
 * `environments.dreamPortals`.
 */

import * as THREE from 'three';
import { decorationBudget } from './decoration_budget';
// Vertical offset of the bonus pocket — far enough that nothing in the main
// playfield (|y| < ~60) can collide with, or be collided by, the room.
import { DREAM_ROOM_Y } from './game_config';

const DEFAULT_DURATION = 35;
const DEFAULT_TOY_COUNT = 18;
const DEFAULT_ORB_COUNT = 8;
const DEFAULT_HAZARD_COUNT = 4;

/** The player's X is frozen inside the pocket, so the room scrolls past them
 *  instead — same side-scroller reading, zero drift in the main world. */
const ROOM_SCROLL_SPEED = 7;

const PROMPT_RADIUS = 26;
const ENTER_RADIUS = 3.2;
const TOY_COLLECT_RADIUS = 2.4;
const HAZARD_RADIUS = 2.6;
const EXIT_RING_RADIUS = 3.6;
/** Exit ring stays inert briefly so arriving next to it can't bounce you out. */
const EXIT_ARM_DELAY = 2.0;
const TRANSITION_DURATION = 0.45;

const TOY_SCORE = 60;
const TOY_CORES = 2;
const COMPLETION_CORES = 12;
const COMPLETION_SCORE = 250;

const THEME_COLORS = {
    pastel: { sky: 0x2b1f4a, glow: 0xffc8f0, accent: 0x9fe8ff },
    candy: { sky: 0x3a1730, glow: 0xffd1e8, accent: 0xffe9a8 },
    aurora: { sky: 0x102a3a, glow: 0xa8ffe0, accent: 0xc8b4ff }
} as const;

export type DreamPortalTheme = keyof typeof THEME_COLORS;

/** Level-config placement for a single portal door. */
export type DreamPortalPlacement = {
    /** World X of the door. */
    x: number;
    y?: number;
    z?: number;
    /** Seconds the player gets inside the room (defaults to 35). */
    durationSeconds?: number;
    toyCount?: number;
    orbCount?: number;
    hazardCount?: number;
    theme?: DreamPortalTheme;
};

export type DreamPortalReward = {
    cores: number;
    score: number;
    toysCollected: number;
    toysTotal: number;
    /** True when every toy in the room was gathered before the timer ran out. */
    cleared: boolean;
};

/** Everything the system needs from the game context, injected by the caller. */
export type DreamPortalCallbacks = {
    getPlayer: () => THREE.Object3D | null;
    /** Current auto-scroll speed (saved on enter, restored on exit). */
    getScrollSpeed: () => number;
    setScrollSpeed: (speed: number) => void;
    /** Raises/lowers the player's vertical clamp origin (see `player_update`). */
    setWorldOriginY: (y: number) => void;
    /** Snap the camera after a teleport so it doesn't lerp across the gap. */
    snapCamera: (y: number) => void;
    /** Gentle push applied when the player bumps a dream jelly. */
    nudgePlayer: (dx: number, dy: number) => void;
    spawnOrb: (x: number, y: number, z: number) => void;
    onEnter?: (portalPosition: THREE.Vector3) => void;
    onExit?: (reward: DreamPortalReward, exitPosition: THREE.Vector3) => void;
    onToyCollected?: (position: THREE.Vector3, score: number) => void;
    onBumper?: (position: THREE.Vector3) => void;
    onPromptShown?: (portalPosition: THREE.Vector3) => void;
};

type PortalInstance = {
    group: THREE.Group;
    ring: THREE.Mesh;
    core: THREE.Mesh;
    placement: Required<Omit<DreamPortalPlacement, 'theme'>> & { theme: DreamPortalTheme };
    used: boolean;
    phase: number;
};

type ToyState = {
    base: THREE.Vector3;
    phase: number;
    spin: number;
    scale: number;
    collected: boolean;
};

type HazardState = {
    mesh: THREE.Mesh;
    base: THREE.Vector3;
    phase: number;
    amplitude: number;
    cooldown: number;
};

type PortalState = 'idle' | 'entering' | 'inRoom' | 'exiting';

/**
 * The player never leaves z = 0, so every interaction test is measured in the
 * XY plane (with a loose depth tolerance) — otherwise props parked at a
 * decorative depth would be literally unreachable.
 */
function distanceXY(a: THREE.Vector3, b: THREE.Vector3): number {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

function makeGlowMaterial(hex: number, opacity: number): THREE.MeshBasicMaterial {
    return new THREE.MeshBasicMaterial({
        color: hex,
        transparent: true,
        opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false
    });
}

export class DreamPortalSystem {
    private readonly scene: THREE.Scene;
    private readonly cb: DreamPortalCallbacks;

    private portals: PortalInstance[] = [];
    private state: PortalState = 'idle';

    // --- room ---------------------------------------------------------------
    /** Static pocket anchor (backdrop + exit ring). */
    private roomGroup: THREE.Group | null = null;
    /** Child of the anchor that slides left so props flow past the player. */
    private roomScroll: THREE.Group | null = null;
    private backdrop: THREE.Mesh | null = null;
    private toyMesh: THREE.InstancedMesh | null = null;
    private toys: ToyState[] = [];
    private hazards: HazardState[] = [];
    private exitRing: THREE.Mesh | null = null;
    private heroLantern: THREE.Group | null = null;
    private readonly dummy = new THREE.Object3D();

    // --- run state ----------------------------------------------------------
    private activePortal: PortalInstance | null = null;
    private transitionTimer = 0;
    private transitionDone = false;
    private roomTimer = 0;
    private roomDuration = DEFAULT_DURATION;
    private roomElapsed = 0;
    private toysCollected = 0;
    private returnY = 0;
    private savedScrollSpeed = 8;
    /** True only between the two teleports, so teardown can't restore twice. */
    private inPocket = false;

    // --- ui -----------------------------------------------------------------
    private promptEl: HTMLDivElement | null = null;
    private hudEl: HTMLDivElement | null = null;
    private hudBarEl: HTMLDivElement | null = null;
    private hudLabelEl: HTMLDivElement | null = null;

    constructor(scene: THREE.Scene, callbacks: DreamPortalCallbacks) {
        this.scene = scene;
        this.cb = callbacks;

        decorationBudget.register('dream_portal', {
            label: 'Dream portal doors',
            category: 'effects',
            maxActive: 3
        });
        decorationBudget.register('dream_room_props', {
            label: 'Dream room props (instanced)',
            category: 'effects',
            maxActive: DEFAULT_TOY_COUNT + DEFAULT_HAZARD_COUNT + 2
        });
    }

    // =========================================================================
    // Portal doors
    // =========================================================================

    spawnPortals(placements: DreamPortalPlacement[]): void {
        this.clear();
        for (const placement of placements) {
            if (!decorationBudget.reportSpawn('dream_portal')) break;
            this.portals.push(this._createPortal(placement));
        }
    }

    clear(): void {
        if (this.state !== 'idle') this._forceExit();
        for (const portal of this.portals) {
            this.scene.remove(portal.group);
            portal.group.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                    child.geometry.dispose();
                    const mat = child.material;
                    if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
                    else mat.dispose();
                }
            });
            decorationBudget.reportDestroy('dream_portal');
        }
        this.portals = [];
        this._hidePrompt();
    }

    /** Scan targets: the doors themselves, plus the room's hero lantern. */
    getScannables(): THREE.Object3D[] {
        const targets: THREE.Object3D[] = this.portals.map((p) => p.group);
        if (this.inPocket && this.heroLantern) targets.push(this.heroLantern);
        return targets;
    }

    isActive(): boolean {
        return this.state !== 'idle';
    }

    /** True while the player is physically inside the pocket — this is what
     *  gates main-run logic (level progression, prefetch). */
    isInRoom(): boolean {
        return this.inPocket;
    }

    getRoomOriginY(): number {
        return DREAM_ROOM_Y;
    }

    private _createPortal(placement: DreamPortalPlacement): PortalInstance {
        const theme = placement.theme ?? 'pastel';
        const colors = THEME_COLORS[theme];
        const group = new THREE.Group();
        group.position.set(placement.x, placement.y ?? 4, placement.z ?? -1);

        // Doorway ring
        const ring = new THREE.Mesh(
            new THREE.TorusGeometry(3.0, 0.34, 10, 36),
            makeGlowMaterial(colors.glow, 0.85)
        );
        group.add(ring);

        // Shimmering "door" disc the player flies through
        const core = new THREE.Mesh(
            new THREE.CircleGeometry(2.75, 32),
            makeGlowMaterial(colors.accent, 0.35)
        );
        core.position.z = -0.05;
        group.add(core);

        // A couple of orbiting sparkles so the door reads as magical at distance
        for (let i = 0; i < 3; i++) {
            const spark = new THREE.Mesh(
                new THREE.SphereGeometry(0.22, 8, 6),
                makeGlowMaterial(0xffffff, 0.9)
            );
            spark.userData.orbitAngle = (i / 3) * Math.PI * 2;
            spark.name = 'dreamPortalSpark';
            group.add(spark);
        }

        group.userData.type = 'dreamPortal';
        group.userData.speciesId = 'dreamPortal';
        this.scene.add(group);

        return {
            group,
            ring,
            core,
            placement: {
                x: placement.x,
                y: placement.y ?? 4,
                z: placement.z ?? -1,
                durationSeconds: placement.durationSeconds ?? DEFAULT_DURATION,
                toyCount: placement.toyCount ?? DEFAULT_TOY_COUNT,
                orbCount: placement.orbCount ?? DEFAULT_ORB_COUNT,
                hazardCount: placement.hazardCount ?? DEFAULT_HAZARD_COUNT,
                theme
            },
            used: false,
            phase: Math.random() * Math.PI * 2
        };
    }

    // =========================================================================
    // Frame update
    // =========================================================================

    update(delta: number, time: number): void {
        const player = this.cb.getPlayer();
        if (!player) return;

        this._animatePortals(delta, time);

        switch (this.state) {
            case 'idle':
                this._updateIdle(player.position);
                break;
            case 'entering':
                this._updateTransition(delta, true);
                break;
            case 'inRoom':
                this._updateRoom(delta, time, player.position);
                break;
            case 'exiting':
                this._updateTransition(delta, false);
                break;
        }
    }

    private _animatePortals(delta: number, time: number): void {
        for (const portal of this.portals) {
            portal.phase += delta;
            const pulse = 1 + Math.sin(time * 2.2 + portal.phase) * 0.06;
            portal.ring.scale.setScalar(pulse);
            portal.ring.rotation.z += delta * 0.35;
            const coreMat = portal.core.material as THREE.MeshBasicMaterial;
            coreMat.opacity = portal.used
                ? 0.08
                : 0.28 + Math.sin(time * 3.1 + portal.phase) * 0.1;

            for (const child of portal.group.children) {
                if (child.name !== 'dreamPortalSpark' || !(child instanceof THREE.Mesh)) continue;
                const angle = (child.userData.orbitAngle ?? 0) + time * 1.4;
                child.position.set(Math.cos(angle) * 3.1, Math.sin(angle) * 3.1, 0.2);
                (child.material as THREE.MeshBasicMaterial).opacity = portal.used ? 0.15 : 0.9;
            }
        }
    }

    private _updateIdle(playerPos: THREE.Vector3): void {
        let nearest: PortalInstance | null = null;
        let nearestDist = Infinity;

        for (const portal of this.portals) {
            if (portal.used) continue;
            const dist = distanceXY(portal.group.position, playerPos);
            if (dist < nearestDist) {
                nearest = portal;
                nearestDist = dist;
            }
        }

        if (!nearest || nearestDist > PROMPT_RADIUS) {
            this._hidePrompt();
            return;
        }

        this._showPrompt();
        this.cb.onPromptShown?.(nearest.group.position);

        if (nearestDist <= ENTER_RADIUS) {
            this._beginEnter(nearest);
        }
    }

    // =========================================================================
    // Enter / exit
    // =========================================================================

    private _beginEnter(portal: PortalInstance): void {
        this.activePortal = portal;
        portal.used = true;
        this.state = 'entering';
        this.transitionTimer = 0;
        this.transitionDone = false;
        this._hidePrompt();
        this.cb.onEnter?.(portal.group.position.clone());
    }

    private _updateTransition(delta: number, entering: boolean): void {
        this.transitionTimer += delta;

        // Teleport at the midpoint so the flash covers the cut.
        if (!this.transitionDone && this.transitionTimer >= TRANSITION_DURATION * 0.5) {
            this.transitionDone = true;
            if (entering) this._enterRoom();
            else this._leaveRoom();
        }

        if (this.transitionTimer >= TRANSITION_DURATION) {
            this.state = entering ? 'inRoom' : 'idle';
            this.transitionTimer = 0;
            this.transitionDone = false;
            if (!entering) this.activePortal = null;
        }
    }

    private _enterRoom(): void {
        const player = this.cb.getPlayer();
        const portal = this.activePortal;
        if (!player || !portal) return;

        this.returnY = player.position.y;
        this.savedScrollSpeed = this.cb.getScrollSpeed();

        const room = this._ensureRoom();
        room.position.set(player.position.x, DREAM_ROOM_Y, 0);
        room.visible = true;

        this._layoutRoom(portal);

        player.position.y = DREAM_ROOM_Y;
        this.cb.setWorldOriginY(DREAM_ROOM_Y);
        this.cb.setScrollSpeed(0);
        this.cb.snapCamera(DREAM_ROOM_Y);

        this.roomDuration = portal.placement.durationSeconds;
        this.roomTimer = this.roomDuration;
        this.roomElapsed = 0;
        this.toysCollected = 0;

        // Star orbs come from the real OrbManager — same economy as the main
        // run. The player's X is frozen here, so the fountain is a vertical
        // column they climb and dive through.
        const orbCount = portal.placement.orbCount;
        for (let i = 0; i < orbCount; i++) {
            const t = orbCount > 1 ? i / (orbCount - 1) : 0.5;
            this.cb.spawnOrb(
                player.position.x + Math.sin(t * Math.PI * 3) * 1.2,
                DREAM_ROOM_Y - 8 + t * 19,
                0
            );
        }

        this.inPocket = true;
        this._showRoomHud();
    }

    private _leaveRoom(): void {
        if (!this.inPocket) return;
        this.inPocket = false;
        const player = this.cb.getPlayer();
        if (player) {
            player.position.y = THREE.MathUtils.clamp(this.returnY, -10, 15);
            this.cb.snapCamera(player.position.y);
        }
        this.cb.setWorldOriginY(0);
        this.cb.setScrollSpeed(this.savedScrollSpeed);
        if (this.roomGroup) this.roomGroup.visible = false;
        this._hideRoomHud();
    }

    /** Emergency teardown (level change / cleanup while the room is open). */
    private _forceExit(): void {
        this._leaveRoom();
        this.state = 'idle';
        this.activePortal = null;
        this.transitionTimer = 0;
        this.transitionDone = false;
    }

    private _beginExit(): void {
        if (this.state !== 'inRoom') return;
        this.state = 'exiting';
        this.transitionTimer = 0;
        this.transitionDone = false;

        const toysTotal = this.toys.length;
        const cleared = toysTotal > 0 && this.toysCollected >= toysTotal;
        const reward: DreamPortalReward = {
            cores: COMPLETION_CORES + this.toysCollected * TOY_CORES + (cleared ? 10 : 0),
            score: COMPLETION_SCORE + (cleared ? 300 : 0),
            toysCollected: this.toysCollected,
            toysTotal,
            cleared
        };
        const exitPos = this.cb.getPlayer()?.position.clone() ?? new THREE.Vector3();
        this.cb.onExit?.(reward, exitPos);
    }

    // =========================================================================
    // Bonus room
    // =========================================================================

    private _ensureRoom(): THREE.Group {
        if (this.roomGroup) return this.roomGroup;

        const room = new THREE.Group();
        room.visible = false;
        const scroll = new THREE.Group();
        room.add(scroll);

        // Soft dome so the pocket doesn't read as empty space.
        this.backdrop = new THREE.Mesh(
            new THREE.SphereGeometry(200, 24, 16),
            new THREE.MeshBasicMaterial({
                color: THEME_COLORS.pastel.sky,
                side: THREE.BackSide,
                fog: false,
                depthWrite: false
            })
        );
        room.add(this.backdrop);

        // Floating toys — one InstancedMesh for the whole set.
        const toyGeo = new THREE.IcosahedronGeometry(0.95, 0);
        const toyMat = new THREE.MeshBasicMaterial({ fog: false });
        this.toyMesh = new THREE.InstancedMesh(toyGeo, toyMat, DEFAULT_TOY_COUNT);
        this.toyMesh.frustumCulled = false;
        this.toyMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        scroll.add(this.toyMesh);

        // Gentle hazards: drifting dream jellies that bump, never damage.
        const hazardGeo = new THREE.SphereGeometry(1.6, 12, 10);
        for (let i = 0; i < DEFAULT_HAZARD_COUNT; i++) {
            const mesh = new THREE.Mesh(hazardGeo, makeGlowMaterial(0xaa88ff, 0.45));
            mesh.visible = false;
            scroll.add(mesh);
            this.hazards.push({
                mesh,
                base: new THREE.Vector3(),
                phase: Math.random() * Math.PI * 2,
                amplitude: 3 + Math.random() * 3,
                cooldown: 0
            });
        }

        // Exit ring — pinned above the player (the pocket's "climb out" door),
        // so it is always reachable and can never strand the player.
        this.exitRing = new THREE.Mesh(
            new THREE.TorusGeometry(3.4, 0.3, 10, 32),
            makeGlowMaterial(0x9fffd0, 0.9)
        );
        this.exitRing.position.set(0, 13, 0);
        room.add(this.exitRing);

        // Hero lantern — the room's scannable, wired into DiscoveryManager.
        const lantern = new THREE.Group();
        const lanternBody = new THREE.Mesh(
            new THREE.OctahedronGeometry(1.4, 0),
            makeGlowMaterial(0xffe9a8, 0.85)
        );
        const lanternHalo = new THREE.Mesh(
            new THREE.SphereGeometry(2.4, 12, 10),
            makeGlowMaterial(0xffd1e8, 0.22)
        );
        lantern.add(lanternBody, lanternHalo);
        lantern.userData.type = 'dreamLantern';
        lantern.userData.speciesId = 'dreamLantern';
        scroll.add(lantern);
        this.heroLantern = lantern;

        this.scene.add(room);
        this.roomGroup = room;
        this.roomScroll = scroll;
        return room;
    }

    /** Re-seed toy / hazard / exit placement for this visit. */
    private _layoutRoom(portal: PortalInstance): void {
        const colors = THEME_COLORS[portal.placement.theme];
        if (this.backdrop) {
            (this.backdrop.material as THREE.MeshBasicMaterial).color.setHex(colors.sky);
        }
        if (this.roomScroll) this.roomScroll.position.set(0, 0, 0);

        // Props are laid out along the distance the room will scroll, so they
        // arrive steadily across the visit rather than all at once.
        const span = ROOM_SCROLL_SPEED * portal.placement.durationSeconds;
        const toyCount = Math.min(portal.placement.toyCount, DEFAULT_TOY_COUNT);
        this.toys = [];
        if (this.toyMesh) {
            this.toyMesh.count = toyCount;
            const toyColor = new THREE.Color();
            for (let i = 0; i < toyCount; i++) {
                const t = i / Math.max(1, toyCount - 1);
                const base = new THREE.Vector3(
                    14 + t * (span - 28) + (Math.random() - 0.5) * 6,
                    (Math.random() - 0.5) * 17,
                    (Math.random() - 0.5) * 4
                );
                this.toys.push({
                    base,
                    phase: Math.random() * Math.PI * 2,
                    spin: 0.4 + Math.random() * 0.8,
                    scale: 0.8 + Math.random() * 0.5,
                    collected: false
                });
                toyColor.setHSL((t * 0.8 + Math.random() * 0.1) % 1, 0.75, 0.65);
                this.toyMesh.setColorAt(i, toyColor);
            }
            if (this.toyMesh.instanceColor) this.toyMesh.instanceColor.needsUpdate = true;
        }

        const hazardCount = Math.min(portal.placement.hazardCount, this.hazards.length);
        this.hazards.forEach((hazard, i) => {
            const enabled = i < hazardCount;
            hazard.mesh.visible = enabled;
            if (!enabled) return;
            hazard.base.set(
                30 + ((i + 0.5) / Math.max(1, hazardCount)) * (span - 60),
                (Math.random() - 0.5) * 12,
                (Math.random() - 0.5) * 3
            );
            hazard.phase = Math.random() * Math.PI * 2;
            hazard.cooldown = 0;
            (hazard.mesh.material as THREE.MeshBasicMaterial).color.setHex(colors.accent);
        });

        if (this.heroLantern) this.heroLantern.position.set(span * 0.45, 8, -2);

        decorationBudget.syncCount('dream_room_props', toyCount + hazardCount + 2);
    }

    private _updateRoom(delta: number, time: number, playerPos: THREE.Vector3): void {
        const room = this.roomGroup;
        const scroll = this.roomScroll;
        if (!room || !scroll) return;

        this.roomElapsed += delta;
        this.roomTimer = Math.max(0, this.roomTimer - delta);

        // Slide the prop layer past the (X-frozen) player.
        scroll.position.x -= ROOM_SCROLL_SPEED * delta;
        const scrollOrigin = room.position.clone().add(scroll.position);

        this._updateToys(delta, time, playerPos, scrollOrigin);
        this._updateHazards(delta, time, playerPos, scrollOrigin);

        if (this.heroLantern) {
            this.heroLantern.rotation.y += delta * 0.6;
            this.heroLantern.position.y = 8 + Math.sin(time * 1.2) * 0.8;
        }

        // Exit ring: pulses, arms after a short delay, then flies you home.
        if (this.exitRing) {
            const armed = this.roomElapsed >= EXIT_ARM_DELAY;
            const pulse = 1 + Math.sin(time * 3) * 0.08;
            this.exitRing.scale.setScalar(pulse);
            this.exitRing.rotation.y += delta * 0.8;
            (this.exitRing.material as THREE.MeshBasicMaterial).opacity = armed ? 0.9 : 0.3;

            if (armed) {
                const ringWorld = this.exitRing.position.clone().add(room.position);
                if (distanceXY(ringWorld, playerPos) <= EXIT_RING_RADIUS) {
                    this._beginExit();
                    return;
                }
            }
        }

        this._updateRoomHud();

        if (this.roomTimer <= 0) {
            this._beginExit();
        }
    }

    private _updateToys(
        delta: number,
        time: number,
        playerPos: THREE.Vector3,
        roomOrigin: THREE.Vector3
    ): void {
        if (!this.toyMesh) return;

        for (let i = 0; i < this.toys.length; i++) {
            const toy = this.toys[i];
            if (toy.collected) continue;

            toy.phase += delta;
            const bob = Math.sin(time * 1.4 + toy.phase) * 0.7;
            const localX = toy.base.x;
            const localY = toy.base.y + bob;
            const localZ = toy.base.z;

            const worldX = roomOrigin.x + localX;
            const worldY = roomOrigin.y + localY;
            const worldZ = roomOrigin.z + localZ;

            const dist = Math.hypot(worldX - playerPos.x, worldY - playerPos.y);
            if (dist <= TOY_COLLECT_RADIUS) {
                toy.collected = true;
                this.toysCollected++;
                this.dummy.position.set(localX, localY, localZ);
                this.dummy.scale.setScalar(0);
                this.dummy.rotation.set(0, 0, 0);
                this.dummy.updateMatrix();
                this.toyMesh.setMatrixAt(i, this.dummy.matrix);
                this.cb.onToyCollected?.(new THREE.Vector3(worldX, worldY, worldZ), TOY_SCORE);
                continue;
            }

            this.dummy.position.set(localX, localY, localZ);
            this.dummy.rotation.set(toy.phase * toy.spin, toy.phase * toy.spin * 0.7, 0);
            this.dummy.scale.setScalar(toy.scale);
            this.dummy.updateMatrix();
            this.toyMesh.setMatrixAt(i, this.dummy.matrix);
        }
        this.toyMesh.instanceMatrix.needsUpdate = true;
    }

    private _updateHazards(
        delta: number,
        time: number,
        playerPos: THREE.Vector3,
        roomOrigin: THREE.Vector3
    ): void {
        for (const hazard of this.hazards) {
            if (!hazard.mesh.visible) continue;

            hazard.phase += delta * 0.6;
            hazard.mesh.position.set(
                hazard.base.x + Math.sin(hazard.phase) * 2.5,
                hazard.base.y + Math.cos(hazard.phase * 0.8) * hazard.amplitude,
                hazard.base.z
            );
            const wobble = 1 + Math.sin(time * 2 + hazard.phase) * 0.08;
            hazard.mesh.scale.set(wobble, 1 / wobble, wobble);

            if (hazard.cooldown > 0) {
                hazard.cooldown = Math.max(0, hazard.cooldown - delta);
                continue;
            }

            const worldPos = hazard.mesh.position.clone().add(roomOrigin);
            const dx = playerPos.x - worldPos.x;
            const dy = playerPos.y - worldPos.y;
            const dist = Math.hypot(dx, dy);
            if (dist <= HAZARD_RADIUS && dist > 0.001) {
                // Gentle bump: pushes the player away, never costs health.
                hazard.cooldown = 0.6;
                this.cb.nudgePlayer((dx / dist) * 2.0, (dy / dist) * 7.0);
                this.cb.onBumper?.(worldPos);
            }
        }
    }

    // =========================================================================
    // UI (prompt + room timer). Touch-friendly: informational only, the player
    // enters and exits by flying, so nothing here needs to be tappable.
    // =========================================================================

    private _showPrompt(): void {
        if (this.promptEl) return;
        const el = document.createElement('div');
        el.id = 'dream-portal-prompt';
        el.textContent = '✨ Dream Door — fly through it!';
        el.style.cssText = `
            position: fixed;
            left: 50%;
            bottom: 18%;
            transform: translateX(-50%);
            padding: 10px 20px;
            border-radius: 22px;
            background: rgba(40, 20, 70, 0.72);
            border: 2px solid rgba(255, 200, 240, 0.85);
            color: #ffe9ff;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            font-size: clamp(14px, 3.4vw, 20px);
            font-weight: bold;
            text-shadow: 0 0 10px rgba(0, 0, 0, 0.6);
            pointer-events: none;
            user-select: none;
            z-index: 600;
        `;
        document.body.appendChild(el);
        this.promptEl = el;
    }

    private _hidePrompt(): void {
        this.promptEl?.remove();
        this.promptEl = null;
    }

    private _showRoomHud(): void {
        if (this.hudEl) return;

        const el = document.createElement('div');
        el.id = 'dream-room-hud';
        el.style.cssText = `
            position: fixed;
            left: 50%;
            top: 12%;
            transform: translateX(-50%);
            width: min(340px, 70vw);
            padding: 8px 14px;
            border-radius: 16px;
            background: rgba(30, 16, 55, 0.68);
            border: 2px solid rgba(200, 180, 255, 0.7);
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            color: #f4e8ff;
            pointer-events: none;
            user-select: none;
            z-index: 600;
        `;

        const label = document.createElement('div');
        label.style.cssText = 'font-size: clamp(12px, 3vw, 16px); font-weight: bold; margin-bottom: 6px; text-align: center;';
        el.appendChild(label);

        const track = document.createElement('div');
        track.style.cssText = 'height: 8px; border-radius: 4px; background: rgba(255,255,255,0.18); overflow: hidden;';
        const bar = document.createElement('div');
        bar.style.cssText = 'height: 100%; width: 100%; border-radius: 4px; background: linear-gradient(90deg, #9fe8ff, #ffc8f0);';
        track.appendChild(bar);
        el.appendChild(track);

        document.body.appendChild(el);
        this.hudEl = el;
        this.hudBarEl = bar;
        this.hudLabelEl = label;
        this._updateRoomHud();
    }

    private _updateRoomHud(): void {
        if (!this.hudEl || !this.hudBarEl || !this.hudLabelEl) return;
        const pct = this.roomDuration > 0 ? (this.roomTimer / this.roomDuration) * 100 : 0;
        this.hudBarEl.style.width = `${Math.max(0, Math.min(100, pct)).toFixed(1)}%`;
        this.hudLabelEl.textContent =
            `💤 Dream Room — toys ${this.toysCollected}/${this.toys.length} · ${Math.ceil(this.roomTimer)}s · ⬆ ring to leave`;
    }

    private _hideRoomHud(): void {
        this.hudEl?.remove();
        this.hudEl = null;
        this.hudBarEl = null;
        this.hudLabelEl = null;
    }

    // =========================================================================

    cleanup(): void {
        this.clear();
        this._hideRoomHud();

        if (this.roomGroup) {
            this.scene.remove(this.roomGroup);
            this.roomGroup.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                    child.geometry.dispose();
                    const mat = child.material;
                    if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
                    else mat.dispose();
                }
            });
            this.roomGroup = null;
            this.roomScroll = null;
            this.backdrop = null;
            this.toyMesh = null;
            this.exitRing = null;
            this.heroLantern = null;
            this.hazards = [];
            this.toys = [];
            decorationBudget.syncCount('dream_room_props', 0);
        }
    }
}
