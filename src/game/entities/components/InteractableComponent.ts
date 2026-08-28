import type { Component } from '../../../domain/components/Component';

// Marks an entity as usable with the interact key. Holds only *what* interacting means
// and how close you must be — deciding *which* interactable wins and rendering the
// prompt is InteractionSystem's job, so statues, bonfires and chests all share one flow.
export class InteractableComponent implements Component {
    public readonly name = 'interactable';
    public readonly radius: number;
    public label: string;

    private onInteract: () => void;

    constructor(radius: number, label: string, onInteract: () => void) {
        this.radius = radius;
        this.label = label;
        this.onInteract = onInteract;
    }

    public interact() {
        this.onInteract();
    }
}
