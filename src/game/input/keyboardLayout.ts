/**
 * Movement keys differ by physical layout: `event.code` reports the QWERTY
 * label of the physical key, so an AZERTY user pressing the key printed "Z"
 * sends `KeyW`... but the key printed "W" sends `KeyZ`. Accepting both sets at
 * once would look like free AZERTY support and is why it is wrong: on QWERTY it
 * silently binds Z to forward and Q to strafe-left, stealing two keys. One
 * layout is active at a time.
 */
export type KeyboardLayout = 'qwerty' | 'azerty';

export type MovementBindings = {
    forward: readonly string[];
    back: readonly string[];
    left: readonly string[];
    right: readonly string[];
};

const ARROW = {
    forward: 'ArrowUp',
    back: 'ArrowDown',
    left: 'ArrowLeft',
    right: 'ArrowRight',
} as const;

const LAYOUTS: Record<KeyboardLayout, MovementBindings> = {
    // WASD.
    qwerty: {
        forward: ['KeyW', ARROW.forward],
        back: ['KeyS', ARROW.back],
        left: ['KeyA', ARROW.left],
        right: ['KeyD', ARROW.right],
    },
    // ZQSD: the same physical keys, which `event.code` names by their QWERTY labels.
    azerty: {
        forward: ['KeyZ', ARROW.forward],
        back: ['KeyS', ARROW.back],
        left: ['KeyQ', ARROW.left],
        right: ['KeyD', ARROW.right],
    },
};

let active: KeyboardLayout = 'qwerty';

export function setKeyboardLayout(layout: KeyboardLayout) {
    active = layout;
}

export function getKeyboardLayout(): KeyboardLayout {
    return active;
}

export function getMovementBindings(): MovementBindings {
    return LAYOUTS[active];
}
