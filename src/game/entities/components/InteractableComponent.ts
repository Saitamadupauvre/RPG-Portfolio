import type { Component } from '../../../domain/components/Component';
import type { PromptAction } from '../../../core/events';

/** A prompt line plus the code it runs. `key` is a KeyboardEvent.code. */
export interface InteractAction extends PromptAction {
    run: () => void;
}

export class InteractableComponent implements Component {
    public readonly name = 'interactable';
    public readonly radius: number;
    public actions: InteractAction[];

    constructor(radius: number, actions: InteractAction[]) {
        this.radius = radius;
        this.actions = actions;
    }

    public interact(key: string): boolean {
        const action = this.actions.find((candidate) => candidate.key === key);
        if (!action) return false;

        action.run();
        return true;
    }
}
