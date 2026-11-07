import * as THREE from 'three';
import type { PropEntity, RockMaterial } from '@data/map/MapEntity';
import { Entity } from '@game/entities/Entity';
import { applyTransform } from '@game/entities/applyTransform';
import { loadModel } from '@game/entities/loadModel';
import type { PropModelDef } from '@data/map/propModels';
import { PALETTE } from '@game/render/materials/palette';
import { createGroundMaterial } from '@game/world/terrain/grass/groundMaterial';
import { createRandom, hashString } from '@game/world/terrain/grass/random';
import { GhostComponent } from '@game/entities/components/effects/GhostComponent';
import { SHORE_LAYER } from '@game/render/layers';

/**
 * A rock is shaded by the terrain's own shader: grass where its surface faces
 * up, bare rock where it is steep. So the material is a choice of rock colour
 * ('cliff' = the terrain's cliffs, 'stone' = cooler ruin stone), and the grass
 * on top always matches the meadow around it. One shared material per choice:
 * the shader reads world position, so nothing is per-rock.
 */
const rockMaterials: Partial<Record<RockMaterial, THREE.MeshLambertMaterial>> = {};

function rockMaterial(kind: RockMaterial): THREE.MeshLambertMaterial {
    rockMaterials[kind] ??= kind === 'cliff'
        ? createGroundMaterial()
        : createGroundMaterial({ rockColor: PALETTE.stone, rockColorDark: PALETTE.stoneDeep });
    return rockMaterials[kind];
}

export function createRock(entity: PropEntity, def: PropModelDef): Entity {
    const group = new THREE.Group();
    applyTransform(group, entity);

    const random = createRandom(hashString(entity.id));
    const material = rockMaterial(entity.material ?? 'stone');

    loadModel(def.url, { height: def.height })
        .then(({ object, materials }) => {
            // loadModel gave the mesh its own lit copy of the exported material; the rock
            // wears the shared ground one instead, so drop the copy.
            object.traverse((child) => {
                if (!(child instanceof THREE.Mesh)) return;
                child.material = material;
                // A rock in the shallows gets its foam ring: see SHORE_LAYER.
                child.layers.enable(SHORE_LAYER);
            });
            for (const own of materials) own.dispose();

            // Same rock, a little flatter or taller each time.
            object.scale.multiply(new THREE.Vector3(0.9 + random() * 0.25, 0.85 + random() * 0.3, 0.9 + random() * 0.25));
            group.add(object);
        })
        .catch((error) => console.error(`[rock] ${def.url} failed to load`, error));

    const scale = Math.max(entity.scale?.[0] ?? 1, entity.scale?.[2] ?? 1);
    const rock = new Entity(entity.id, group, def.radius * scale, true);
    // Modelled with its base at the origin; the height lets a lifted rock clear whoever walks under it.
    rock.bodyHeight = def.height * (entity.scale?.[1] ?? 1);
    return rock
        .addComponent('ghost', new GhostComponent(group))
        // The ground materials are shared by every rock; the default disposer would free them under the others.
        .setDisposer(() => {});
}
