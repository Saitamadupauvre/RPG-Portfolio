import type { StatId } from './stats';
import type { TutorialId } from './tutorials';

export type Vec3 = [number, number, number];

export interface MapEntityTransform {
    /** Y is informative only: entities are seated on the terrain under (x, z). */
    position: Vec3;
    rotation?: Vec3;
    scale?: Vec3;
    /** Raise (or, negative, sink) the entity relative to the ground under it. Follows the terrain when it is resculpted. */
    heightOffset?: number;
}

export interface EnemyEntity extends MapEntityTransform {
    kind: 'enemy';
    id: string;
    enemyType: 'grunt' | 'elite' | 'archer' | 'dragon' | 'boss';
}

/**
 * What a chest hands out. Tagged union so new reward kinds are added by writing
 * one member plus one handler in `domain/chestLoot.ts` — nothing else changes.
 */
export type ChestLoot =
    | { kind: 'coins'; amount: number }
    | { kind: 'project'; projectId: string }
    | { kind: 'stat'; statId: StatId };

export interface ChestEntity extends MapEntityTransform {
    kind: 'chest';
    id: string;
    chestTier: 'wood' | 'silver' | 'gold';
    loot: ChestLoot[];
}

export interface ItemEntity extends MapEntityTransform {
    kind: 'item';
    id: string;
    itemType: string;
    projectId?: string;
}

/**
 * What a rock is made of. 'cliff' is the terrain's own rock, so a boulder blends
 * into the cliff beside it; 'stone' is the cooler grey-violet of ruins and walls.
 * Either way the top of the rock grows the same grass as the ground.
 */
export type RockMaterial = 'stone' | 'cliff';

export interface PropEntity extends MapEntityTransform {
    kind: 'prop';
    id: string;
    /** A model id from `data/propModels.ts`. */
    propType: string;
    /** Only rocks read it; defaults to 'stone'. */
    material?: RockMaterial;
}

export interface StatueEntity extends MapEntityTransform {
    kind: 'statue';
    id: string;
    projectId: string;
}

export interface BonfireEntity extends MapEntityTransform {
    kind: 'bonfire';
    id: string;
    /** A campfire model id from `data/bonfireModels.ts`; absent = the default one. */
    model?: string;
}

/**
 * What a trigger does when the player walks in. Tagged union like `ChestLoot`:
 * a new custom event is one member here plus one handler in `domain/triggerActions.ts`.
 */
export type TriggerAction = { kind: 'tutorial'; tutorialId: TutorialId };

/**
 * An invisible box volume (visible in the editor only). Its size is its `scale`:
 * the box is one unit wide and deep, one unit tall from the ground up.
 */
export interface TriggerEntity extends MapEntityTransform {
    kind: 'trigger';
    id: string;
    action: TriggerAction;
}

export type MapEntity = EnemyEntity | ChestEntity | ItemEntity | PropEntity | StatueEntity | BonfireEntity | TriggerEntity;
