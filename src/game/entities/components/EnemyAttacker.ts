import * as THREE from 'three';
import type { Component } from '../../../domain/components/Component';
import type { ComboComponent } from './ComboComponent';

/**
 * How an enemy attacks once it has caught up with the player. The AI only
 * decides *when* to chase; the attacker decides when it is close enough and
 * whether it currently owns the body.
 */
export interface EnemyAttacker extends Component {
    /**
     * Called every chase frame with the player's distance. Returns true when
     * the AI must stop pathing this frame (attacking, or close enough to).
     */
    engage(target: THREE.Vector3, distance: number): boolean;
    reset(): void;
}

/** Stand-in-place melee: wind up and swing once the player is within `range`. */
export class ComboAttacker implements EnemyAttacker {
    public readonly name = 'comboAttacker';

    private combo: ComboComponent;
    private range: number;

    constructor(combo: ComboComponent, range: number) {
        this.combo = combo;
        this.range = range;
    }

    public engage(target: THREE.Vector3, distance: number): boolean {
        if (distance > this.range) return false;
        this.combo.trigger(target);
        return true;
    }

    public reset() {
        this.combo.reset();
    }

    public update(dt: number) {
        this.combo.update(dt);
    }
}
