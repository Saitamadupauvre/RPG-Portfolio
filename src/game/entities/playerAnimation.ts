import type { AnimatorControllerDefinition } from '../../domain/animation/AnimatorController';

/**
 * The player's animation graph. Clips are the Actions `tools/blender/make_player.py` bakes into
 * `public/player/player.glb`, by name; the graph decides when each plays. Nothing about *how*
 * they look lives here. The model also carries an Empty named `Socket_HandR` on the hand bone,
 * at the grip, where the sword hangs (blade along its local +Z in game).
 *
 * Attack clips are not played at their own pace: ComboPlayback scrubs them so that the windup
 * covers 0..swingStart, the live hitbox swingStart..swingEnd and the recovery the rest.
 * Markers are seconds and must follow the script's SLASH_* frames (frame / 24).
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
        /** Walk playback rate: move speed over the speed the clip was animated for. */
        walkRate: 'float',
    },
    layers: [
        {
            name: 'base',
            states: [
                { name: 'idle', clip: 'Idle', loop: true },
                {
                    name: 'walk', clip: 'Walk', loop: true, speedParam: 'walkRate',
                    // Feet land at the bottom of the bounce: frames 3 and 9 of walk_pose's 12.
                    events: [{ name: 'footstep', time: 3 / FPS }, { name: 'footstep', time: 9 / FPS }],
                },
                { name: 'dash', clip: 'Dash' },
                { name: 'slash', clip: 'Slash', speed: 0, markers: { swingStart: 8 / FPS, swingEnd: 14 / FPS } },
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
                { from: 'slash', to: 'walk', conditions: [{ param: 'attacking', is: false }, { param: 'moving', is: true }], duration: 0.15 },
                { from: 'slash', to: 'idle', conditions: [{ param: 'attacking', is: false }], duration: 0.2 },
            ],
        },
        // To keep the legs walking under a swing later: add a layer with `mask: [...arm bone names]`
        // holding the attack states plus an empty pass-through state, and move the attack
        // transitions there. The blend already supports it.
    ],
};
