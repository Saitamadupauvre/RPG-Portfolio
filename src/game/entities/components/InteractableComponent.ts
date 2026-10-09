import type { Component } from '../../../domain/components/Component';
import type { PromptAction } from '../../../core/events';

/** A prompt line plus the code it runs. `key` is a KeyboardEvent.code. */
export interface InteractAction extends PromptAction {
    run: () => void;
}

export type InteractableOptions = {
    /** Standing in range lets the player buy stats in the book (bonfires). */
    allowsLevelUp?: boolean;
};

export class InteractableComponent implements Component {
    public readonly name = 'interactable';
    public readonly radius: number;
    public readonly allowsLevelUp: boolean;
    public actions: InteractAction[];

    constructor(radius: number, actions: InteractAction[], options: InteractableOptions = {}) {
        this.radius = radius;
        this.actions = actions;
        this.allowsLevelUp = options.allowsLevelUp ?? false;
    }

    public interact(key: string): boolean {
        const action = this.actions.find((candidate) => candidate.key === key);
        if (!action) return false;

        action.run();
        return true;
    }
}
