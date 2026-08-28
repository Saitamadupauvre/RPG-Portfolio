export type Vec3 = [number, number, number];

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

export interface PropEntity extends MapEntityTransform {
    kind: 'prop';
    id: string;
    propType: string;
    collidable?: boolean;
}

export interface StatueEntity extends MapEntityTransform {
    kind: 'statue';
    id: string;
    projectId: string;
}

export interface BonfireEntity extends MapEntityTransform {
    kind: 'bonfire';
    id: string;
}

export type MapEntity = EnemyEntity | ChestEntity | ItemEntity | PropEntity | StatueEntity | BonfireEntity;
