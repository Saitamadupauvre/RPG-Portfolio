import * as THREE from 'three';
import { events } from '../core/events';
import { stateMachine } from '../core/StateMachine';
import type { Entity } from './entities/Entity';
import type { InteractableComponent } from './entities/components/InteractableComponent';

const INTERACT_KEY = 'KeyE';

// Picks the single closest in-range interactable each frame, publishes its label for the
// DOM prompt, and routes the interact key to it. Centralising this means a new interactable
// entity type only needs an InteractableComponent — no extra listener, no extra prompt code.
export class InteractionSystem {
    private currentLabel: string | null = null;
    private pressed = false;

    constructor() {
        window.addEventListener('keydown', (event) => {
            // Ignore auto-repeat so holding E doesn't fire the interaction every frame.
            if (event.code === INTERACT_KEY && !event.repeat) this.pressed = true;
        });
    }

    public update(entities: Entity[], playerPosition: THREE.Vector3) {
        const target = stateMachine.getState() === 'GAME' ? this.findNearest(entities, playerPosition) : null;

        this.setPrompt(target?.getComponent<InteractableComponent>('interactable')?.label ?? null);

        if (this.pressed) {
            this.pressed = false;
            target?.getComponent<InteractableComponent>('interactable')?.interact();
        }
    }

    private findNearest(entities: Entity[], playerPosition: THREE.Vector3): Entity | null {
        let nearest: Entity | null = null;
        let nearestDistance = Infinity;

        for (const entity of entities) {
            const interactable = entity.getComponent<InteractableComponent>('interactable');
            if (!interactable) continue;

            // Squared distance: same ordering as real distance, no sqrt per entity per frame.
            const distanceSq = entity.mesh.position.distanceToSquared(playerPosition);
            if (distanceSq > interactable.radius * interactable.radius) continue;
            if (distanceSq >= nearestDistance) continue;

            nearest = entity;
            nearestDistance = distanceSq;
        }

        return nearest;
    }

    // Only emits on change, so the UI layer isn't rewritten 60 times a second.
    private setPrompt(label: string | null) {
        if (label === this.currentLabel) return;
        this.currentLabel = label;
        events.emit('interactPromptChange', label);
    }
}
