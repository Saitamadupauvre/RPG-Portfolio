import * as THREE from 'three';
import type { PropEntity } from '../../data/MapEntity';
import { Entity } from './Entity';
import { applyTransform } from './applyTransform';
import { loadModel } from './loadModel';
import type { PropModelDef } from '../../data/propModels';
import { PALETTE } from '../render/palette';
import { jitterColor, type TintSpread } from '../render/tint';
import { applyTreeSway, tickTreeSway } from '../render/treeSway';
import { createRandom, hashString } from '../world/grass/random';
import { GhostComponent } from './components/GhostComponent';
import { disposeObject3D } from './disposeObject3D';

/**
 * How far below the ground the model's base sits, in unscaled world units. A
 * ramp drops half a unit per tile-width unit, so the downhill edge of a
 * 0.4-radius trunk is 0.2 under its centre: 0.25 keeps it rooted on any ramp.
 * Bushes are short and wide, so they only need a hair.
 */
const TREE_SINK = 0.25;
const BUSH_SINK = 0.05;

const LEAF_SPREAD: TintSpread ={ hue: 0.05, saturation: 0.1, lightness: 0.07 };

/** Base foliage colours; a repeated entry is a likelier pick, and autumn stays rare. */
const LEAF_COLORS = [
    PALETTE.leafBright,
    PALETTE.leafBright,
    PALETTE.leafBright,
    PALETTE.leafLime,
    PALETTE.leafLime,
    PALETTE.leaf,
    PALETTE.autumn,
];

/** Bushes stay green: no lime, no autumn. */
const BUSH_COLORS = [PALETTE.leafBright, PALETTE.leafBright, PALETTE.leaf];
const BUSH_SPREAD: TintSpread = { hue: 0.02, saturation: 0.08, lightness: 0.06 };

export function createTree(entity: PropEntity, def: PropModelDef): Entity {
    const group = new THREE.Group();
    applyTransform(group, entity);

    const random = createRandom(hashString(entity.id));

    // Anchored on the model's own origin: the trunk base is the point the tree is seated and collides on.
    // Sunk a little, since the ground is sampled at the trunk's centre only.
    const sink = def.kind === 'bush' ? BUSH_SINK : TREE_SINK;
    loadModel(def.url, { height: def.height, anchor: 'origin', originY: -sink })
        .then(({ object, materials }) => {
            // The fit scaled the model uniformly, so this recovers its size in the units its shader sees.
            const modelHeight = def.height / object.scale.y;
            const isBush = def.kind === 'bush';
            const colors = isBush ? BUSH_COLORS : LEAF_COLORS;
            const spread = isBush ? BUSH_SPREAD : LEAF_SPREAD;
            const leafColor = colors[Math.floor(random() * colors.length)];
            for (const material of materials) {
                // Bark varies far less than leaves; a whisper is enough.
                if (material.name.startsWith('Canopy')) material.color.copy(jitterColor(leafColor, random, spread));
                else material.color.copy(jitterColor(PALETTE.bark, random, LEAF_SPREAD, 0.3));
                applyTreeSway(material, modelHeight, def.height);
            }
            object.traverse((child) => {
                if (!(child instanceof THREE.Mesh)) return;
                child.onBeforeRender = tickTreeSway;
                // The crown shading itself with the sun is what blackens its underside.
                if (child.material instanceof THREE.Material && child.material.name.startsWith('Canopy')) {
                    child.receiveShadow = false;
                }
            });
            // Stretch each tree a little differently, so equal-sized trees still differ in shape.
            object.scale.multiply(new THREE.Vector3(0.9 + random() * 0.25, 0.9 + random() * 0.3, 0.9 + random() * 0.25));
            group.add(object);
        })
        .catch((error) => console.error(`[tree] ${def.url} failed to load`, error));

    const scale = Math.max(entity.scale?.[0] ?? 1, entity.scale?.[2] ?? 1);
    const ghost = new GhostComponent(group);
    // A radius of 0 is a bush: no body, the player walks through it.
    return new Entity(entity.id, group, def.radius > 0 ? def.radius * scale : undefined, true)
        .addComponent('ghost', ghost)
        // Own materials back on first, so they are the ones freed (their ghosts follow them).
        .setDisposer(() => {
            ghost.setGhosted(false);
            disposeObject3D(group);
        });
}
