export type Vec3 = [number, number, number];

export interface EnemyEntity {
    kind: 'enemy';
    id: string;
    enemyType: 'grunt' | 'elite' | 'boss';
    position: Vec3;
    rotationY?: number;
}

export interface ChestEntity {
    kind: 'chest';
    id: string;
    chestTier: 'wood' | 'silver' | 'gold';
    position: Vec3;
}

export interface ItemEntity {
    kind: 'item';
    id: string;
    itemType: string;
    position: Vec3;
    projectId?: string;
}

export interface PropEntity {
    kind: 'prop';
    id: string;
    propType: string;
    position: Vec3;
    rotationY?: number;
}

export type MapEntity = EnemyEntity | ChestEntity | ItemEntity | PropEntity;
