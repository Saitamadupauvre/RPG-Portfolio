export type Vec3 = [number, number, number];

// Every placed thing has a full transform so the editor's move/rotate/scale gizmos can
// write straight back into map data. Rotation is euler XYZ in radians (Three's default
// order); rotation/scale are optional so hand-written entries stay short.
export interface MapEntityTransform {
    position: Vec3;
    rotation?: Vec3;
    scale?: Vec3;
}

export interface EnemyEntity extends MapEntityTransform {
    kind: 'enemy';
    id: string;
    enemyType: 'grunt' | 'elite' | 'boss';
}

export interface ChestEntity extends MapEntityTransform {
    kind: 'chest';
    id: string;
    chestTier: 'wood' | 'silver' | 'gold';
}

export interface ItemEntity extends MapEntityTransform {
    kind: 'item';
    id: string;
    itemType: string;
    projectId?: string;
}

// Props are unit-sized boxes shaped by `scale` — the scale gizmo is the only sizing tool,
// so there's no separate `size` field to keep in sync with it.
export interface PropEntity extends MapEntityTransform {
    kind: 'prop';
    id: string;
    propType: string;
    collidable?: boolean;
}

// A statue is the primary project-discovery surface: it always carries a project,
// glows until found, and stays in the world afterwards (only the glow goes away).
// Separate kind from `item` because item.projectId is optional and items disappear.
export interface StatueEntity extends MapEntityTransform {
    kind: 'statue';
    id: string;
    projectId: string;
}

// Checkpoint. Resting refills hp, moves the respawn point here, and resets every
// non-boss enemy — the Dark Souls loop.
export interface BonfireEntity extends MapEntityTransform {
    kind: 'bonfire';
    id: string;
}

export type MapEntity = EnemyEntity | ChestEntity | ItemEntity | PropEntity | StatueEntity | BonfireEntity;
