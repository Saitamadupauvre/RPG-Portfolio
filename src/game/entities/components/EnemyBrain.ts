import type * as THREE from 'three';
import type { Component } from '../../../domain/components/Component';

/**
 * What the rest of the game asks of an enemy's AI, however it behaves: a hunter chasing the
 * player down (EnemyAIComponent) or a critter roaming its patch of the map (RoamAIComponent).
 * Registered as the entity's `enemyAI` component.
 */
export interface EnemyBrain extends Component {
    /** After the player right now: what lights its x-ray silhouette. */
    readonly isAggroed: boolean;
    /** Back to its just-spawned state around a (new) home point. */
    reset(origin: THREE.Vector3): void;
}
