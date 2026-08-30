/**
 * Dream portal room construction, toys/hazards, and HUD helpers.
 */

import * as THREE from 'three';
import { decorationBudget } from '../decoration_budget';
import {
    DEFAULT_TOY_COUNT,
    DEFAULT_HAZARD_COUNT,
    ROOM_SCROLL_SPEED,
    TOY_COLLECT_RADIUS,
    HAZARD_RADIUS,
    EXIT_RING_RADIUS,
    EXIT_ARM_DELAY,
    TOY_SCORE,
    THEME_COLORS,
    type DreamPortalPlacement,
    type PortalInstance,
    type ToyState,
    type HazardState,
    type PortalState,
    type DreamPortalCallbacks,
    distanceXY,
    makeGlowMaterial
} from './types';

export abstract class DreamPortalRoomOps {
    protected abstract scene: THREE.Scene;
    protected abstract cb: DreamPortalCallbacks;
    protected abstract clear(): void;
    protected abstract _beginExit(): void;

    protected portals: PortalInstance[] = [];
    protected state: PortalState = 'idle';
    protected roomGroup: THREE.Group | null = null;
    protected roomScroll: THREE.Group | null = null;
    protected backdrop: THREE.Mesh | null = null;
    protected toyMesh: THREE.InstancedMesh | null = null;
    protected toys: ToyState[] = [];
    protected hazards: HazardState[] = [];
    protected exitRing: THREE.Mesh | null = null;
    protected heroLantern: THREE.Group | null = null;
    protected readonly dummy = new THREE.Object3D();
    protected activePortal: PortalInstance | null = null;
    protected transitionTimer = 0;
    protected transitionDone = false;
    protected inPocket = false;
    protected returnY = 0;
    protected savedScrollSpeed = 0;
    protected roomTimer = 0;
    protected roomDuration = 35;
    protected roomElapsed = 0;
    protected toysCollected = 0;
    protected promptEl: HTMLDivElement | null = null;
    protected hudEl: HTMLDivElement | null = null;
    protected hudBarEl: HTMLDivElement | null = null;
    protected hudLabelEl: HTMLDivElement | null = null;

    protected _ensureRoom(): THREE.Group {
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
    protected _layoutRoom(portal: PortalInstance): void {
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

    protected _updateRoom(delta: number, time: number, playerPos: THREE.Vector3): void {
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

    protected _updateToys(
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

    protected _updateHazards(
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
                this.cb.motion.nudgePlayer((dx / dist) * 2.0, (dy / dist) * 7.0);
                this.cb.onBumper?.(worldPos);
            }
        }
    }

    // =========================================================================
    // UI (prompt + room timer). Touch-friendly: informational only, the player
    // enters and exits by flying, so nothing here needs to be tappable.
    // =========================================================================

    protected _showPrompt(): void {
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

    protected _hidePrompt(): void {
        this.promptEl?.remove();
        this.promptEl = null;
    }

    protected _showRoomHud(): void {
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

    protected _updateRoomHud(): void {
        if (!this.hudEl || !this.hudBarEl || !this.hudLabelEl) return;
        const pct = this.roomDuration > 0 ? (this.roomTimer / this.roomDuration) * 100 : 0;
        this.hudBarEl.style.width = `${Math.max(0, Math.min(100, pct)).toFixed(1)}%`;
        this.hudLabelEl.textContent =
            `💤 Dream Room — toys ${this.toysCollected}/${this.toys.length} · ${Math.ceil(this.roomTimer)}s · ⬆ ring to leave`;
    }

    protected _hideRoomHud(): void {
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
