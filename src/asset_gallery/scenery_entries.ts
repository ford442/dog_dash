/**
 * Gallery entries for scenery, backdrops and flavor creatures (#418). Each
 * entry builds the shared geometry + material the system instances, so the
 * gallery shows what the game draws. Instanced systems are shown as a single
 * `Mesh` of the same geometry and material.
 *
 * State mapping:
 * - **idle**: resting loop, player far away.
 * - **telegraph**: player close (the proximity tell: isle hook ring lights,
 *   star peeks bright, bunny glows, geode crystals brighten).
 * - **hit**: the gameplay-linked flare: singing geode sings (re-triggered
 *   every 2 s), storm geode throws an arc (every 1.5 s).
 *
 * Foliage and the galaxy/moon have no state; they show the idle loop.
 */

import * as THREE from 'three';
import { uniform } from 'three/tsl';
import { getIsleGeometry } from '../scenery_art/isles';
import { getPeekingStarGeometry } from '../scenery_art/star';
import { getSpacePetGeometry } from '../scenery_art/space_pet';
import { getGeodeGeometry, type GeodeKind } from '../scenery_art/geodes';
import { getMirrorShardGeometry } from '../scenery_art/mirror';
import { createIsleMaterial } from '../grapple_isles';
import { createHideAndSeekStarMaterial } from '../hide_and_seek_stars';
import { createSpacePetMaterial } from '../space_pets_swarm';
import { createSingingGeodeMaterial } from '../singing_geodes';
import { createStormGeodeMaterial } from '../storm_geodes';
import { createQuantumMirrorMaterial } from '../quantum_mirrors';
import { CollectibleOrb } from '../collectibles/orb';
import { OrbType } from '../collectibles/types';
import { createGalaxy, createMoon, moonPlants } from '../visuals';
import {
    createBalloonBush,
    createFloatingOrb,
    createFloweringTree,
    createRainingCloud,
    createShrub
} from '../foliage/plants_basic';
import { disposeObject } from '../utils';
import { registerGalleryEntries, type GalleryContext, type GalleryEntry, type GalleryInstance } from './registry';

const FAR = new THREE.Vector3(1e4, 1e4, 1e4);

/** Player-position uniform posed by the gallery state (near in telegraph). */
function playerUniform() {
    return uniform(FAR.clone());
}

function posePlayer(u: { value: unknown }, ctx: GalleryContext, near: THREE.Vector3): void {
    (u.value as THREE.Vector3).copy(ctx.mode === 'telegraph' ? near : FAR);
}

function meshInstance(mesh: THREE.Mesh, update?: GalleryInstance['update']): GalleryInstance {
    const holder = new THREE.Group();
    holder.add(mesh);
    return {
        object: holder,
        update,
        dispose: () => disposeObject(holder) // shared geometry is skipped (markShared)
    };
}

const entries: GalleryEntry[] = [
    {
        id: 'scenery_grapple_isle',
        label: 'Grapple isle',
        category: 'scenery',
        note: 'Flat grass top, crag underside, roots, tree, lantern, hook ring. Ring lights near the player.',
        build: () => {
            const uTime = uniform(0);
            const uPlayer = playerUniform();
            const mesh = new THREE.Mesh(getIsleGeometry(), createIsleMaterial(uTime, uPlayer));
            return meshInstance(mesh, (dt, _t, ctx) => {
                uTime.value += dt;
                posePlayer(uPlayer, ctx, new THREE.Vector3(0, 0, 2));
            });
        }
    },
    {
        id: 'scenery_hide_and_seek_star',
        label: 'Hide-and-seek star',
        category: 'scenery',
        note: 'Same five-point star as the pickup, with eyes. Peeks bright near the player.',
        build: () => {
            const uPlayer = playerUniform();
            const mesh = new THREE.Mesh(getPeekingStarGeometry(), createHideAndSeekStarMaterial(uPlayer));
            return meshInstance(mesh, (_dt, t, ctx) => {
                posePlayer(uPlayer, ctx, new THREE.Vector3(0, 0, 3));
                const peek = ctx.mode === 'telegraph' ? 1 : 0.45;
                mesh.scale.setScalar(peek * (1 + Math.sin(t * 3) * 0.1));
                mesh.rotation.set(0, Math.sin(t * 0.9) * 0.5, Math.sin(t * 0.6) * 0.3);
            });
        }
    },
    {
        id: 'scenery_collectible_star',
        label: 'Collectible star (pickup)',
        category: 'scenery',
        note: 'Shares the star body with the backdrop star (was a dodecahedron).',
        build: () => {
            const scene = new THREE.Scene();
            const orb = new CollectibleOrb(scene, 0, 0, 0, OrbType.STAR);
            orb.mesh.removeFromParent();
            const holder = new THREE.Group();
            holder.add(orb.mesh);
            return {
                object: holder,
                update: (dt, t) => orb.update(dt, t),
                dispose: () => orb.destroy(scene)
            };
        }
    },
    {
        id: 'scenery_space_pet',
        label: 'Space pet (bunny)',
        category: 'scenery',
        note: 'Merged bunny: ears, helmet + visor, tail, feet. Ears flop; glows near the player.',
        build: () => {
            const uPlayer = playerUniform();
            const mesh = new THREE.Mesh(getSpacePetGeometry(), createSpacePetMaterial(uPlayer));
            mesh.rotation.y = 0.9;
            return meshInstance(mesh, (_dt, _t, ctx) => posePlayer(uPlayer, ctx, new THREE.Vector3(0, 0, 1)));
        }
    },
    ...(['singing', 'storm'] as GeodeKind[]).map((kind): GalleryEntry => ({
        id: `scenery_geode_${kind}`,
        label: kind === 'singing' ? 'Singing geode' : 'Storm geode',
        category: 'scenery',
        note: kind === 'singing'
            ? 'Round bowl, ragged mouth, crown of crystal pipes. Hit: sings (crystals flare).'
            : 'Flat angular boulder, zig-zag crack, needle shards. Hit: arc flash.',
        build: () => {
            const flare = uniform(0);
            const mat = kind === 'singing' ? createSingingGeodeMaterial(flare) : createStormGeodeMaterial(flare);
            const mesh = new THREE.Mesh(getGeodeGeometry(kind), mat);
            const period = kind === 'singing' ? 2 : 1.5;
            const decay = kind === 'singing' ? 1.2 : 4;
            return meshInstance(mesh, (_dt, t, ctx) => {
                const since = t % period;
                flare.value = ctx.mode === 'hit' ? Math.exp(-since * decay)
                    : ctx.mode === 'telegraph' ? 0.35 : 0;
            });
        }
    })),
    {
        id: 'scenery_quantum_mirror',
        label: 'Quantum mirror shard',
        category: 'scenery',
        note: 'Thin broken-mirror pane (was a jittered icosahedron). Same 20 triangles.',
        build: () => {
            const mesh = new THREE.Mesh(getMirrorShardGeometry(), createQuantumMirrorMaterial());
            mesh.scale.setScalar(0.5);
            return meshInstance(mesh, (dt) => { mesh.rotation.x += dt * 0.4; mesh.rotation.z += dt * 0.3; });
        }
    },
    {
        id: 'scenery_galaxy',
        label: 'Spiral galaxy (backdrop)',
        category: 'scenery',
        note: 'Shader disc: two arms, clusters, bulge. 1 draw call (was 3 nested spheres). Silhouette shows the quad.',
        build: () => {
            const galaxy = createGalaxy(0, 0, 0, 0x8844ff);
            galaxy.rotation.set(-0.7, 0, 0);
            const holder = new THREE.Group();
            holder.add(galaxy);
            return { object: holder, update: (dt) => { galaxy.rotation.z += dt * 0.3; }, dispose: () => disposeObject(holder) };
        }
    },
    {
        id: 'scenery_moon',
        label: 'Moon (backdrop)',
        category: 'scenery',
        span: 2,
        note: 'Carved craters (bowl + rim) and the dog\'s paw-print flag at the pole.',
        build: () => {
            const before = moonPlants.length;
            const moon = createMoon();
            const plants = moonPlants.splice(before); // gallery copy: keep the game's plant list clean
            const holder = new THREE.Group();
            holder.add(moon);
            return {
                object: holder,
                update: (dt) => { moon.rotation.y += dt * 0.15; },
                dispose: () => { plants.length = 0; disposeObject(holder); }
            };
        }
    },
    ...([
        ['shrub', 'Shrub', 'Leaf dome + folded blades + five-petal flowers. 2 draw calls (was 4–6).', () => createShrub()],
        ['balloon_bush', 'Balloon bush', 'Leafy base, balloons with knots and strings. 2 draw calls (was 5–9).', () => createBalloonBush()],
        ['raining_cloud', 'Raining cloud', 'Row of puffs with a flat grey base + rain.', () => createRainingCloud()],
        ['floating_orb', 'Floating orb (seed pod)', 'Glowing bulb cupped by sepals; only the bulb glows.', () => createFloatingOrb({ color: 0x88ccff })],
        ['flowering_tree', 'Flowering tree', 'Forked trunk, lumpy blossom clumps. 2 draw calls (was 6–10).', () => createFloweringTree({ color: 0xffaa44 })]
    ] as Array<[string, string, string, () => THREE.Object3D]>).map(([id, label, note, make]): GalleryEntry => ({
        id: `scenery_foliage_${id}`,
        label: `Foliage — ${label}`,
        category: 'scenery',
        note,
        build: () => {
            const plant = make();
            plant.rotation.y = 0;
            const holder = new THREE.Group();
            holder.add(plant);
            return { object: holder, dispose: () => disposeObject(holder) };
        }
    }))
];

registerGalleryEntries(...entries);
