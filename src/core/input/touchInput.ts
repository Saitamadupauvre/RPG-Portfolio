/**
 * The on-screen sticks, written by `ui/views/TouchControlsView` and read by the
 * game every frame. Polled rather than sent as events: a stick moves on every
 * pointer event, and the game only cares where it stands when a frame runs.
 * One-off presses (tap to attack, dash, interact) go through `core/events/events` instead.
 *
 * Screen axes: `x` to the right, `y` up the screen, length 0 to 1.
 */
export type StickAxis = { x: number; y: number };

export const touchInput = {
    move: { x: 0, y: 0 } as StickAxis,
};

/** Below this length the stick counts as centred, so a resting thumb never walks. */
export const STICK_DEADZONE = 0.2;

export function stickActive(axis: StickAxis): boolean {
    return axis.x * axis.x + axis.y * axis.y > STICK_DEADZONE * STICK_DEADZONE;
}
