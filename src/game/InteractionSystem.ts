import * as THREE from 'three';
import { events } from '../core/events';
import { stateMachine } from '../core/StateMachine';
import type { Entity } from './entities/Entity';
import type { InteractAction } from './entities/components/InteractableComponent';

export class InteractionSystem {
    private currentActions: readonly InteractAction[] | null = null;
    private pressedKeys = new Set<string>();

    constructor() {
        window.addEventListener('keydown', (event) => {
            // Only remember keys the current target actually listens for, so
            // unrelated presses never queue up between frames.
            if (event.repeat) return;
            if (!this.currentActions?.some((action) => action.key === event.code)) return;

            this.pressedKeys.add(event.code);
        });
    }

    public update(entities: Entity[], playerPosition: THREE.Vector3) {
        const target = stateMachine.getState() === 'GAME' ? this.findNearest(entities, playerPosition) : null;
        const actions = target?.getComponent('interactable')?.actions ?? null;

        this.setPrompt(actions);

        for (const key of this.pressedKeys) {
            target?.getComponent('interactable')?.interact(key);
        }
        this.pressedKeys.clear();
    }

    private findNearest(entities: Entity[], playerPosition: THREE.Vector3): Entity | null {
        let nearest: Entity | null = null;
        let nearestDistance = Infinity;

        for (const entity of entities) {
            const interactable = entity.getComponent('interactable');
            if (!interactable) continue;

            const distanceSq = entity.mesh.position.distanceToSquared(playerPosition);
            if (distanceSq > interactable.radius * interactable.radius) continue;
            if (distanceSq >= nearestDistance) continue;

            nearest = entity;
            nearestDistance = distanceSq;
        }

        return nearest;
    }

    private setPrompt(actions: readonly InteractAction[] | null) {
        if (actions === this.currentActions) return;

        this.currentActions = actions;
        events.emit('interactPromptChange', actions);
    }
}
