import * as THREE from 'three';
import type { PropEntity } from '@data/map/MapEntity';
import { Entity } from '@game/entities/Entity';
import { applyTransform } from '@game/entities/applyTransform';
import type { PropModelDef } from '@data/map/propModels';
import { PALETTE } from '@game/render/materials/palette';
import { jitterColor, type TintSpread } from '@game/render/materials/tint';
import { applyTreeSway, tickTreeSway } from '@game/render/treeSway';
import { createRandom, hashString } from '@game/world/terrain/grass/random';
import { GhostComponent } from '@game/entities/components/effects/GhostComponent';
import { propInstancer, type BatchOptions } from '@game/render/PropInstancer';

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

/** Shared by every copy of a model: the sway patch, the clock, the crown that shades nothing. */
function batchOptions(def: PropModelDef, sink: number): BatchOptions {
    return {
        url: def.url,
        // Anchored on the model's own origin: the trunk base is the point the tree is seated and collides on.
        // Sunk a little, since the ground is sampled at the trunk's centre only.
        fit: { height: def.height, anchor: 'origin', originY: -sink },
        // A bush's shadow is a smudge under half a metre of leaves, and there are hundreds of them.
        castShadow: def.kind !== 'bush',
        prepare: (material, modelHeight) => applyTreeSway(material, modelHeight, def.height),
        decorate: (mesh) => {
            mesh.onBeforeRender = tickTreeSway;
            // The crown shading itself with the sun is what blackens its underside.
            if (mesh.material instanceof THREE.Material && mesh.material.name.startsWith('Canopy')) {
                mesh.receiveShadow = false;
            }
        },
    };
}

export function createTree(entity: PropEntity, def: PropModelDef): Entity {
    const group = new THREE.Group();
    applyTransform(group, entity);

    const random = createRandom(hashString(entity.id));
    const isBush = def.kind === 'bush';
    const sink = isBush ? BUSH_SINK : TREE_SINK;

    // Drawn by the instancer, one batch per model; the group only says where this one stands.
    const instance = propInstancer.place(batchOptions(def, sink), group, (materials) => {
        const colors = isBush ? BUSH_COLORS : LEAF_COLORS;
        const spread = isBush ? BUSH_SPREAD : LEAF_SPREAD;
        const leafColor = colors[Math.floor(random() * colors.length)];
        return {
            // Bark varies far less than leaves; a whisper is enough.
            colors: materials.map((material) => material.name.startsWith('Canopy')
                ? jitterColor(leafColor, random, spread)
                : jitterColor(PALETTE.bark, random, LEAF_SPREAD, 0.3)),
            // Stretch each tree a little differently, so equal-sized trees still differ in shape.
            stretch: new THREE.Vector3(0.9 + random() * 0.25, 0.9 + random() * 0.3, 0.9 + random() * 0.25),
        };
    });

    const scale = Math.max(entity.scale?.[0] ?? 1, entity.scale?.[2] ?? 1);
    const ghost = new GhostComponent(group, instance);
    // A radius of 0 is a bush: no body, the player walks through it.
    return new Entity(entity.id, group, def.radius > 0 ? def.radius * scale : undefined, true)
        .addComponent('ghost', ghost)
        // The batch's geometry and materials are shared: only this copy goes (its stand-in with it).
        .setDisposer(() => {
            ghost.setGhosted(false);
            instance.remove();
        });
}
