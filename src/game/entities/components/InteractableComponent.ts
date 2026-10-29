import type { Component } from '../../../domain/components/Component';
import type { PromptAction } from '../../../core/events';
import { keyFor } from '../../../domain/settings';

/** A prompt line plus the code it runs, fired by whatever key is bound to its `input`. */
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

    /** `code` is a `KeyboardEvent.code`. */
    public interact(code: string): boolean {
        const action = this.actions.find((candidate) => keyFor(candidate.input) === code);
        if (!action) return false;

        action.run();
        return true;
    }
}
