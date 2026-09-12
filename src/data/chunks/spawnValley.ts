import type { MapEntity } from '../MapEntity';

/** The starting bowl: first bonfire, the two tutorial walls, the home statue. */
export const spawnValley: MapEntity[] = [
    { kind: 'enemy', id: 'grunt-1', enemyType: 'grunt', position: [3, 0.5, 3] },
    { kind: 'enemy', id: 'elite-1', enemyType: 'elite', position: [-3, 0.75, -3] },

    { kind: 'bonfire', id: 'bonfire-spawn', position: [0, 0, 2] },

    { kind: 'statue', id: 'statue-rpg-portfolio', projectId: 'rpg-portfolio', position: [0, 0, -6] },
    { kind: 'statue', id: 'statue-two', projectId: 'project-two', position: [-7, 0, 4] },
    { kind: 'statue', id: 'statue-three', projectId: 'project-three', position: [7, 0, 4] },

    { kind: 'chest', id: 'chest-coins', chestTier: 'wood', position: [5, 0, -2], loot: [{ kind: 'coins', amount: 40 }] },

    { kind: 'prop', id: 'wall-1', propType: 'wall', position: [-3.5, 1, 1.5], scale: [5, 1, 0.6], collidable: true },
    { kind: 'prop', id: 'wall-2', propType: 'wall', position: [3.5, 1, 1.5], scale: [5, 1, 0.6], collidable: true },
];
