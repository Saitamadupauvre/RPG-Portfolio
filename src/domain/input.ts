import type { MoveAction } from '../data/settings';

/** Always move, on top of whatever the moves are bound to. Not rebindable. */
export const ARROW_KEYS: Readonly<Record<MoveAction, string>> = {
    up: 'ArrowUp',
    left: 'ArrowLeft',
    down: 'ArrowDown',
    right: 'ArrowRight',
};

/** Escape opens the settings; Tab, the OS key and the F row belong to the browser; the arrows always move. */
const RESERVED = /^(Escape|Tab|Meta(Left|Right)|ContextMenu|F\d{1,2}|Arrow(Up|Down|Left|Right))$/;

/** A key no action can be bound to. */
export function isReservedKey(code: string): boolean {
    return RESERVED.test(code);
}

const NAMED_KEYS: Record<string, string> = {
    Space: 'Space',
    Enter: 'Enter',
    Backspace: 'Bksp',
    ShiftLeft: 'Shift',
    ShiftRight: 'R-Shift',
    ControlLeft: 'Ctrl',
    ControlRight: 'R-Ctrl',
    AltLeft: 'Alt',
    AltRight: 'Alt Gr',
    CapsLock: 'Caps',
    ArrowUp: '↑',
    ArrowDown: '↓',
    ArrowLeft: '←',
    ArrowRight: '→',
    Delete: 'Del',
    Insert: 'Ins',
    Home: 'Home',
    End: 'End',
    PageUp: 'PgUp',
    PageDown: 'PgDn',
};

/** A readable name for a key code, as printed on a QWERTY keyboard. */
export function keyLabel(code: string): string {
    const named = NAMED_KEYS[code];
    if (named) return named;
    if (code.startsWith('Key')) return code.slice(3);
    if (code.startsWith('Digit')) return code.slice(5);
    if (code.startsWith('Numpad')) return `Num ${code.slice(6)}`;
    return code;
}

/**
 * What to print for a key the player just pressed: the character on the key
 * when it has one, so an AZERTY player who presses A sees A, not Q.
 */
export function labelForKey(event: { code: string; key: string }): string {
    if ([...event.key].length === 1 && event.key !== ' ') return event.key.toUpperCase();
    return keyLabel(event.code);
}
