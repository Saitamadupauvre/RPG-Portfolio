import type { AnimatorControllerDefinition } from '../../domain/animation/AnimatorController';

/**
 * The soldier's (elite) animation graph. The clips come from `public/models/enemy-soldier.glb`,
 * built and animated by `tools/blender/make_enemies.py`.
 *
 * Same convention as the player's graph, so ComboPlayback drives both: `move` picks the
 * attack (0 = Thrust, 1 = Slam, the order of the elite's moves in EnemyPool), the `attack`
 * trigger enters it, and the clip is scrubbed onto the combo's windup / hitbox / recovery
 * through its swingStart / swingEnd markers. Markers are seconds, Blender frame / fps, and
 * must follow the script's THRUST_* / SLAM_*.
 */
const FPS = 24;

export const soldierController: AnimatorControllerDefinition = {
    parameters: {
        moving: 'bool',
        attacking: 'bool',
        attack: 'trigger',
        move: 'float',
    },
    layers: [
        {
            name: 'base',
            states: [
                { name: 'idle', clip: 'Idle', loop: true },
                { name: 'walk', clip: 'Walk', loop: true },
                { name: 'thrust', clip: 'Thrust', speed: 0, markers: { swingStart: 8 / FPS, swingEnd: 13 / FPS } },
                { name: 'slam', clip: 'Slam', speed: 0, markers: { swingStart: 12 / FPS, swingEnd: 18 / FPS } },
            ],
            transitions: [
                { from: 'idle', to: 'walk', conditions: [{ param: 'moving', is: true }], duration: 0.15 },
                { from: 'walk', to: 'idle', conditions: [{ param: 'moving', is: false }], duration: 0.2 },
                {
                    from: '*', to: 'thrust', duration: 0.08, canTransitionToSelf: true,
                    conditions: [{ param: 'attack', is: true }, { param: 'move', equals: 0 }],
                },
                {
                    from: '*', to: 'slam', duration: 0.08, canTransitionToSelf: true,
                    conditions: [{ param: 'attack', is: true }, { param: 'move', equals: 1 }],
                },
                { from: 'thrust', to: 'walk', conditions: [{ param: 'attacking', is: false }, { param: 'moving', is: true }], duration: 0.15 },
                { from: 'thrust', to: 'idle', conditions: [{ param: 'attacking', is: false }], duration: 0.2 },
                { from: 'slam', to: 'walk', conditions: [{ param: 'attacking', is: false }, { param: 'moving', is: true }], duration: 0.15 },
                { from: 'slam', to: 'idle', conditions: [{ param: 'attacking', is: false }], duration: 0.25 },
            ],
        },
    ],
};
