import * as THREE from 'three';
import type { PropEntity } from '@data/map/MapEntity';
import { Entity } from '@game/entities/Entity';
import { applyTransform } from '@game/entities/applyTransform';
import { createTree } from './TreeFactory';
import { createRock } from './RockFactory';
import { isPropModel, PROP_MODELS } from '@data/map/propModels';

export function createProp(entity: PropEntity): Entity {
    if (!isPropModel(entity.propType)) {
        // A saved layout can name a model that no longer exists; keep the entity, show nothing.
        console.warn(`[prop] unknown model "${entity.propType}" on ${entity.id}`);
        const empty = new THREE.Group();
        applyTransform(empty, entity);
        return new Entity(entity.id, empty, undefined, true);
    }

    const def = PROP_MODELS[entity.propType];
    return def.kind === 'rock' ? createRock(entity, def) : createTree(entity, def);
}
