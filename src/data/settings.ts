/**
 * Player preferences, types only. Here rather than in `domain/` so
 * `core/events.ts` and book content (`ControlHint.action`) can name them
 * without importing upward, like `stats.ts`.
 */

/**
 * Every key the player can rebind. The four moves are screen directions (the
 * camera is fixed); the arrow keys move too, whatever these are bound to.
 */
export const INPUT_ACTIONS = ['up', 'left', 'down', 'right', 'dash', 'interact', 'levelUp', 'book'] as const;

/** The moves, in keyboard-cross order: the first on top, the other three below. */
export const MOVE_ACTIONS = ['up', 'left', 'down', 'right'] as const satisfies readonly InputAction[];

export type MoveAction = (typeof MOVE_ACTIONS)[number];

export type InputAction = (typeof INPUT_ACTIONS)[number];

/**
 * A bound key: `code` is what the game matches (`KeyboardEvent.code`, named
 * after the QWERTY key at that position), `label` the character printed on it
 * as seen when the player bound it. They differ on AZERTY: the key printed A
 * sends `KeyQ`. Empty for the defaults, which are named from their code by the
 * interface (it can ask the browser for the real layout).
 */
export type KeyBinding = { code: string; label: string };

export const QUALITY_LEVELS = ['low', 'medium', 'high'] as const;

export type Quality = (typeof QUALITY_LEVELS)[number];

export type Settings = {
    keys: Record<InputAction, KeyBinding>;
    quality: Quality;
    screenShake: boolean;
};
