import * as THREE from 'three';
import type { BonfireEntity } from '../../data/MapEntity';
import { BONFIRE_MODELS, DEFAULT_BONFIRE_MODEL, isBonfireModel } from '../../data/bonfireModels';
import { Entity } from './Entity';
import { applyTransform } from './applyTransform';
import { events } from '../../core/events';
import { setCheckpoint } from '../../domain/checkpoint';
import { FireComponent } from './components/FireComponent';
import { InteractableComponent } from './components/InteractableComponent';
import { BONFIRE_COLLISION_RADIUS } from './collisionSizes';
import { loadModel } from './loadModel';

const INTERACT_RADIUS = 2.2;
/** Multiplies the campfire textures' colours; above 1 brightens them. */
const MODEL_BRIGHTNESS = 1.7;

export function createBonfire(entity: BonfireEntity): Entity {
    const group = new THREE.Group();
    applyTransform(group, entity);

    const modelId = entity.model && isBonfireModel(entity.model) ? entity.model : DEFAULT_BONFIRE_MODEL;
    const model = BONFIRE_MODELS[modelId];

    loadModel(model.url, { height: model.height })
        .then(({ object, materials }) => {
            // The source palette is dull next to the grass; push it up toward the art direction's warm stone.
            for (const material of materials) material.color.multiplyScalar(MODEL_BRIGHTNESS);
            group.add(object);
        })
        .catch((error) => console.error(`[bonfire] ${model.url} failed to load`, error));

    // The flames do not wait for the model: they are their own effect, parented to the same spot.
    const fire = new FireComponent(group, entity.position, model.fireHeight);

    const interactable = new InteractableComponent(INTERACT_RADIUS, [
        {
            key: 'KeyE',
            label: 'Rest at bonfire',
            run: () => {
                setCheckpoint(entity.position);
                events.emit('bonfireRested');
            },
        },
        {
            key: 'KeyF',
            label: 'Level up',
            run: () => events.emit('levelUpRequested'),
        },
    ], { allowsLevelUp: true });

    return new Entity(entity.id, group, BONFIRE_COLLISION_RADIUS, true)
        .addComponent('fire', fire)
        .addComponent('interactable', interactable);
}
