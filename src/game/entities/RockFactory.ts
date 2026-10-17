import * as THREE from 'three';
import type { PropEntity, RockMaterial } from '../../data/MapEntity';
import { Entity } from './Entity';
import { applyTransform } from './applyTransform';
import { loadModel } from './loadModel';
import type { PropModelDef } from '../../data/propModels';
import { PALETTE } from '../render/palette';
import { createGroundMaterial } from '../world/grass/groundMaterial';
import { createRandom, hashString } from '../world/grass/random';

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
                if (child instanceof THREE.Mesh) child.material = material;
            });
            for (const own of materials) own.dispose();

            // Same rock, a little flatter or taller each time.
            object.scale.multiply(new THREE.Vector3(0.9 + random() * 0.25, 0.85 + random() * 0.3, 0.9 + random() * 0.25));
            group.add(object);
        })
        .catch((error) => console.error(`[rock] ${def.url} failed to load`, error));

    const scale = Math.max(entity.scale?.[0] ?? 1, entity.scale?.[2] ?? 1);
    return new Entity(entity.id, group, def.radius * scale, true)
        // The ground materials are shared by every rock; the default disposer would free them under the others.
        .setDisposer(() => {});
}
