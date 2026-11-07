import type { AnimatorControllerDefinition } from '../../domain/animation/AnimatorController';

/**
 * The goblin's (grunt) animation graph. The clips come from `public/models/enemy-goblin.glb`,
 * built and animated by `tools/blender/make_enemies.py`.
 *
 * Idle and Walk play at their own pace. Lunge never does: LungeAnimationDriver scrubs it to
 * LungeComponent's phases — the prepare onto 0..dash (crouch, tremble), the dash onto
 * dash..recover (the leap), the recovery onto the rest (skid, settle). Markers are seconds,
 * Blender frame / fps, and must follow the script's LUNGE_DASH / LUNGE_RECOVER.
 */
const FPS = 24;

export const goblinController: AnimatorControllerDefinition = {
    parameters: {
        moving: 'bool',
        lunging: 'bool',
    },
    layers: [
        {
            name: 'base',
            states: [
                { name: 'idle', clip: 'Idle', loop: true },
                { name: 'walk', clip: 'Walk', loop: true },
                { name: 'lunge', clip: 'Lunge', speed: 0, markers: { dash: 13 / FPS, recover: 19 / FPS } },
            ],
            transitions: [
                { from: '*', to: 'lunge', conditions: [{ param: 'lunging', is: true }], duration: 0.08 },
                { from: 'idle', to: 'walk', conditions: [{ param: 'moving', is: true }], duration: 0.12 },
                { from: 'walk', to: 'idle', conditions: [{ param: 'moving', is: false }], duration: 0.18 },
                { from: 'lunge', to: 'walk', conditions: [{ param: 'lunging', is: false }, { param: 'moving', is: true }], duration: 0.15 },
                { from: 'lunge', to: 'idle', conditions: [{ param: 'lunging', is: false }], duration: 0.2 },
            ],
        },
    ],
};
