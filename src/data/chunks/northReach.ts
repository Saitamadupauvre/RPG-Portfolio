import type { MapEntity } from '../MapEntity';

/** Past the walls: the second bonfire and the richer chests. */
export const northReach: MapEntity[] = [
    { kind: 'bonfire', id: 'bonfire-north', position: [0, 0, -10] },

    { kind: 'chest', id: 'chest-vitality', chestTier: 'silver', position: [-5, 0, -8], loot: [{ kind: 'stat', statId: 'health' }] },
    {
        kind: 'chest', id: 'chest-hoard', chestTier: 'gold', position: [9, 0, -9],
        loot: [
            { kind: 'coins', amount: 120 },
            { kind: 'stat', statId: 'speed' },
            { kind: 'project', projectId: 'project-three' },
        ],
    },
];
