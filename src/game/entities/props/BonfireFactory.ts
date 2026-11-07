import * as THREE from 'three';
import type { BonfireEntity } from '@data/map/MapEntity';
import { BONFIRE_MODELS, DEFAULT_BONFIRE_MODEL, isBonfireModel } from '@data/map/bonfireModels';
import { Entity } from '@game/entities/Entity';
import { applyTransform } from '@game/entities/applyTransform';
import { events } from '@core/events/events';
import { setCheckpoint } from '@domain/save/checkpoint';
import { FireComponent } from '@game/entities/components/effects/FireComponent';
import { InteractableComponent } from '@game/entities/components/interaction/InteractableComponent';
import { BONFIRE_COLLISION_RADIUS } from '@game/entities/collisionSizes';
import { loadModel } from '@game/entities/loadModel';

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
            input: 'interact',
            label: { key: 'prompt.rest' },
            run: () => {
                setCheckpoint(entity.position);
                events.emit('restRequested');
            },
        },
        {
            input: 'levelUp',
            label: { key: 'prompt.levelUp' },
            run: () => events.emit('levelUpRequested'),
        },
    ], { allowsLevelUp: true });

    return new Entity(entity.id, group, BONFIRE_COLLISION_RADIUS, true)
        .addComponent('fire', fire)
        .addComponent('interactable', interactable);
}
