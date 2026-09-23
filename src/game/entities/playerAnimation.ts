import type { AnimatorControllerDefinition } from '../../domain/animation/AnimatorController';

/**
 * The player's animation graph. Clips are the Actions exported from Blender, by name; the
 * graph decides when each plays. Nothing about *how* they look lives here.
 *
 * Blender checklist for `public/player/player.glb`:
 *   - one Action per clip below, pushed down to an NLA track so the exporter writes them all
 *   - an Empty named `Socket_HandR`, parented to the hand bone, sitting at the grip: the sword's
 *     handle passes through it, blade along the Empty's local +Z as seen in game
 *   - export glTF Binary with Animation enabled
 *
 * Attack clips are not played at their own pace: the driver scrubs them so that the windup
 * covers 0..swingStart, the live hitbox swingStart..swingEnd and the recovery the rest.
 * Markers are seconds, so a swing on Blender frames 8-14 at 24 fps is `8 / 24` to `14 / 24`.
 * Combat timings themselves stay in `COMBO_MOVES`.
 */
const FPS = 24;

export const playerController: AnimatorControllerDefinition = {
    parameters: {
        moving: 'bool',
        dashing: 'bool',
        attacking: 'bool',
        attack: 'trigger',
        /** Index of the combo move being swung; picks which attack state the trigger fires. */
        move: 'float',
    },
    layers: [
        {
            name: 'base',
            states: [
                { name: 'idle', clip: 'Idle', loop: true },
                { name: 'walk', clip: 'Walk', loop: true },
                { name: 'dash', clip: 'Dash' },
                { name: 'slash', clip: 'Slash', speed: 0, markers: { swingStart: 8 / FPS, swingEnd: 14 / FPS } },
                { name: 'chop', clip: 'Chop', speed: 0, markers: { swingStart: 8 / FPS, swingEnd: 13 / FPS } },
            ],
            transitions: [
                { from: 'idle', to: 'walk', conditions: [{ param: 'moving', is: true }], duration: 0.12 },
                { from: 'walk', to: 'idle', conditions: [{ param: 'moving', is: false }], duration: 0.18 },
                { from: '*', to: 'dash', conditions: [{ param: 'dashing', is: true }], duration: 0.05 },
                // Order matters: the walk exit is checked first, so a dash that ends mid-run resumes running.
                { from: 'dash', to: 'walk', conditions: [{ param: 'dashing', is: false }, { param: 'moving', is: true }], duration: 0.15 },
                { from: 'dash', to: 'idle', conditions: [{ param: 'dashing', is: false }], duration: 0.2 },
                {
                    from: '*', to: 'slash', duration: 0.06, canTransitionToSelf: true,
                    conditions: [{ param: 'attack', is: true }, { param: 'move', equals: 0 }],
                },
                {
                    from: '*', to: 'chop', duration: 0.06, canTransitionToSelf: true,
                    conditions: [{ param: 'attack', is: true }, { param: 'move', equals: 1 }],
                },
                { from: 'slash', to: 'walk', conditions: [{ param: 'attacking', is: false }, { param: 'moving', is: true }], duration: 0.15 },
                { from: 'slash', to: 'idle', conditions: [{ param: 'attacking', is: false }], duration: 0.2 },
                { from: 'chop', to: 'walk', conditions: [{ param: 'attacking', is: false }, { param: 'moving', is: true }], duration: 0.15 },
                { from: 'chop', to: 'idle', conditions: [{ param: 'attacking', is: false }], duration: 0.25 },
            ],
        },
        // To keep the legs walking under a swing later: add a layer with `mask: [...arm bone names]`
        // holding the attack states plus an empty pass-through state, and move the attack
        // transitions there. The blend already supports it.
    ],
};
