import type { MapEntity } from './MapEntity';

export const mapLayout: MapEntity[] = [
    { kind: 'enemy', id: 'grunt-1', enemyType: 'grunt', position: [3, 0.5, 3] },
    { kind: 'enemy', id: 'elite-1', enemyType: 'elite', position: [-3, 0.75, -3] },

    // Test obstacle: a wall with a gap at x:[-1,1], forcing pathfinding to route through it.
    // Kept off z=0 so it doesn't overlap the player's spawn point.
    { kind: 'bonfire', id: 'bonfire-spawn', position: [0, 0, 2] },
    { kind: 'bonfire', id: 'bonfire-north', position: [0, 0, -10] },

    { kind: 'statue', id: 'statue-rpg-portfolio', projectId: 'rpg-portfolio', position: [0, 0, -6] },
    { kind: 'statue', id: 'statue-two', projectId: 'project-two', position: [-7, 0, 4] },
    { kind: 'statue', id: 'statue-three', projectId: 'project-three', position: [7, 0, 4] },

    { kind: 'prop', id: 'wall-1', propType: 'wall', position: [-3.5, 1, 1.5], scale: [5, 1, 0.6], collidable: true },
    { kind: 'prop', id: 'wall-2', propType: 'wall', position: [3.5, 1, 1.5], scale: [5, 1, 0.6], collidable: true },
];
