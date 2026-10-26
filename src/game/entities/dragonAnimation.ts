import type { AnimatorControllerDefinition } from '../../domain/animation/AnimatorController';

/**
 * The fox dragon's animation graph. The clips come from `public/models/enemy-dragon.glb`,
 * built and animated by `tools/blender/make_enemies.py`.
 *
 * Idle plays at its own pace. Run plays at the speed the dragon really runs: `runRate` is its
 * ground speed over RUN_CLIP_SPEED, the speed the clip's planted paws were measured for, so
 * the feet never skate. Breath never plays by itself: BreathAnimationDriver scrubs it to
 * BreathComponent's phases, the windup onto 0..fire (rear back, inhale), the flame onto
 * fire..stop (head thrust forward, jaw wide) and the recovery onto the rest, so the jaw opens
 * on the very frame the fire starts however the timings are tuned. Markers are seconds,
 * Blender frame / fps, and must follow the script's BREATH_FIRE / BREATH_STOP.
 */
const FPS = 30;

/** Ground speed Run is animated for: DRAGON_GAME_SPEED in the script, at the fit height EnemyPool gives the model. */
export const RUN_CLIP_SPEED = 5.5;

export const dragonController: AnimatorControllerDefinition = {
    parameters: {
        moving: 'bool',
        breathing: 'bool',
        runRate: 'float',
    },
    layers: [
        {
            name: 'base',
            states: [
                { name: 'idle', clip: 'Idle', loop: true },
                { name: 'run', clip: 'Run', loop: true, speedParam: 'runRate' },
                { name: 'breath', clip: 'Breath', speed: 0, markers: { fire: 12 / FPS, stop: 30 / FPS } },
            ],
            transitions: [
                { from: '*', to: 'breath', conditions: [{ param: 'breathing', is: true }], duration: 0.1 },
                { from: 'idle', to: 'run', conditions: [{ param: 'moving', is: true }], duration: 0.1 },
                { from: 'run', to: 'idle', conditions: [{ param: 'moving', is: false }], duration: 0.15 },
                { from: 'breath', to: 'run', conditions: [{ param: 'breathing', is: false }, { param: 'moving', is: true }], duration: 0.12 },
                { from: 'breath', to: 'idle', conditions: [{ param: 'breathing', is: false }], duration: 0.2 },
            ],
        },
    ],
};
