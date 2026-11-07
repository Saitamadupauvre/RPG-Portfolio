import type { AnimatorControllerDefinition } from '../../domain/animation/AnimatorController';

/**
 * The skeleton archer's animation graph. The clips come from `public/models/enemy-skeleton.glb`,
 * built and animated by `tools/blender/make_enemies.py`.
 *
 * Idle and Walk play at their own pace. Shoot and Hop never do: ArcherAnimationDriver scrubs
 * them to ShootComponent's timings, the draw onto the clip up to `release` and the recovery
 * onto the rest, so the string lets go on the very frame the arrow leaves however the draw
 * is tuned. Markers are seconds, Blender frame / fps, and must follow the script's
 * SHOOT_RELEASE if it changes.
 */
const FPS = 24;

export const archerController: AnimatorControllerDefinition = {
    parameters: {
        moving: 'bool',
        shooting: 'bool',
        hopping: 'bool',
    },
    layers: [
        {
            name: 'base',
            states: [
                { name: 'idle', clip: 'Idle', loop: true },
                { name: 'walk', clip: 'Walk', loop: true },
                { name: 'shoot', clip: 'Shoot', speed: 0, markers: { release: 22 / FPS } },
                { name: 'hop', clip: 'Hop', speed: 0 },
            ],
            transitions: [
                { from: '*', to: 'hop', conditions: [{ param: 'hopping', is: true }], duration: 0.05 },
                { from: '*', to: 'shoot', conditions: [{ param: 'shooting', is: true }], duration: 0.1 },
                { from: 'idle', to: 'walk', conditions: [{ param: 'moving', is: true }], duration: 0.15 },
                { from: 'walk', to: 'idle', conditions: [{ param: 'moving', is: false }], duration: 0.2 },
                // A shot cut short by a flinch eases the bow back down through these too.
                { from: 'shoot', to: 'walk', conditions: [{ param: 'shooting', is: false }, { param: 'moving', is: true }], duration: 0.15 },
                { from: 'shoot', to: 'idle', conditions: [{ param: 'shooting', is: false }], duration: 0.2 },
                { from: 'hop', to: 'walk', conditions: [{ param: 'hopping', is: false }, { param: 'moving', is: true }], duration: 0.15 },
                { from: 'hop', to: 'idle', conditions: [{ param: 'hopping', is: false }], duration: 0.15 },
            ],
        },
    ],
};
