import * as THREE from 'three';
import { events } from '../core/events';
import { isGameplayActive } from '../core/pause';
import type { Entity } from './entities/Entity';
import type { InteractAction } from './entities/components/InteractableComponent';

export class InteractionSystem {
    private currentActions: readonly InteractAction[] | null = null;
    private levelUpAvailable = false;
    private pressedKeys = new Set<string>();

    constructor() {
        window.addEventListener('keydown', (event) => {
            // Only remember keys the current target actually listens for, so
            // unrelated presses never queue up between frames.
            // An E pressed behind an open modal must not queue up and fire on close.
            if (event.repeat || !isGameplayActive()) return;
            if (!this.currentActions?.some((action) => action.key === event.code)) return;

            this.pressedKeys.add(event.code);
        });
    }

    public update(entities: Entity[], playerPosition: THREE.Vector3) {
        const target = isGameplayActive() ? this.findNearest(entities, playerPosition) : null;
        const actions = target?.getComponent('interactable')?.actions ?? null;

        this.setPrompt(actions);
        this.setLevelUpAvailable(target?.getComponent('interactable')?.allowsLevelUp ?? false);

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
            // A spent interactable (looted chest) keeps its component but no actions;
            // skipping it here stops it from shadowing a live one standing further away.
            if (!interactable || interactable.actions.length === 0) continue;

            const distanceSq = entity.mesh.position.distanceToSquared(playerPosition);
            if (distanceSq > interactable.radius * interactable.radius) continue;
            if (distanceSq >= nearestDistance) continue;

            nearest = entity;
            nearestDistance = distanceSq;
        }

        return nearest;
    }

    /**
     * Not called while paused (World skips the update), so the value read when the
     * book opens is the one from the last gameplay frame: still at the bonfire.
     */
    private setLevelUpAvailable(available: boolean) {
        if (available === this.levelUpAvailable) return;

        this.levelUpAvailable = available;
        events.emit('levelUpAvailableChanged', available);
    }

    private setPrompt(actions: readonly InteractAction[] | null) {
        if (actions === this.currentActions) return;

        this.currentActions = actions;
        events.emit('interactPromptChange', actions);
    }
}
