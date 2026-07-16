import type { MapEntity } from './MapEntity';

export const mapLayout: MapEntity[] = [
    {
        kind: 'enemy',
        id: 'grunt-01',
        enemyType: 'grunt',
        position: [3, 0, 0],
    },
    {
        kind: 'chest',
        id: 'chest-01',
        chestTier: 'wood',
        position: [5, 0, 0],
    },
    {
        kind: 'item',
        id: 'item-01',
        itemType: 'scroll',
        position: [-3, 0, 0],
        projectId: 'rpg-portfolio',
    },
    {
        kind: 'prop',
        id: 'rock-01',
        propType: 'rock',
        position: [0, 0, -4],
    },
];
