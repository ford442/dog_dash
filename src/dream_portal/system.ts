/**
 * Dream Portal Doors — secret cloud doorways into a short bonus dream room.
 */

import * as THREE from 'three';
import { decorationBudget } from '../decoration_budget';
import { DREAM_ROOM_Y } from '../game_config';
import { DreamPortalRoomOps } from './room_ops';
import {
    DEFAULT_DURATION,
    DEFAULT_TOY_COUNT,
    DEFAULT_ORB_COUNT,
    DEFAULT_HAZARD_COUNT,
    PROMPT_RADIUS,
    ENTER_RADIUS,
    TRANSITION_DURATION,
    TOY_CORES,
    COMPLETION_CORES,
    COMPLETION_SCORE,
    THEME_COLORS,
    type DreamPortalCallbacks,
    type DreamPortalPlacement,
    type DreamPortalReward,
    type PortalInstance,
    distanceXY,
    makeGlowMaterial
} from './types';

export class DreamPortalSystem extends DreamPortalRoomOps {
    protected scene: THREE.Scene;
    protected cb: DreamPortalCallbacks;

    constructor(scene: THREE.Scene, callbacks: DreamPortalCallbacks) {
        super();
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

    protected _createPortal(placement: DreamPortalPlacement): PortalInstance {
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

    protected _animatePortals(delta: number, time: number): void {
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

    protected _updateIdle(playerPos: THREE.Vector3): void {
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

    protected _beginEnter(portal: PortalInstance): void {
        this.activePortal = portal;
        portal.used = true;
        this.state = 'entering';
        this.transitionTimer = 0;
        this.transitionDone = false;
        this._hidePrompt();
        this.cb.onEnter?.(portal.group.position.clone());
    }

    protected _updateTransition(delta: number, entering: boolean): void {
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

    protected _enterRoom(): void {
        const player = this.cb.getPlayer();
        const portal = this.activePortal;
        if (!player || !portal) return;

        this.returnY = player.position.y;
        this.savedScrollSpeed = this.cb.motion.getScrollSpeed();

        const room = this._ensureRoom();
        room.position.set(player.position.x, DREAM_ROOM_Y, 0);
        room.visible = true;

        this._layoutRoom(portal);

        player.position.y = DREAM_ROOM_Y;
        this.cb.motion.setWorldOriginY(DREAM_ROOM_Y);
        this.cb.motion.setScrollSpeed(0);
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

    protected _leaveRoom(): void {
        if (!this.inPocket) return;
        this.inPocket = false;
        const player = this.cb.getPlayer();
        if (player) {
            player.position.y = THREE.MathUtils.clamp(this.returnY, -10, 15);
            this.cb.snapCamera(player.position.y);
        }
        this.cb.motion.setWorldOriginY(0);
        this.cb.motion.setScrollSpeed(this.savedScrollSpeed);
        if (this.roomGroup) this.roomGroup.visible = false;
        this._hideRoomHud();
    }

    /** Emergency teardown (level change / cleanup while the room is open). */
    protected _forceExit(): void {
        this._leaveRoom();
        this.state = 'idle';
        this.activePortal = null;
        this.transitionTimer = 0;
        this.transitionDone = false;
    }

    protected _beginExit(): void {
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
}
