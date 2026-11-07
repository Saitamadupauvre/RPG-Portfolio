import type { KeyBinding } from '../../data/settings';
import { keyLabel } from '../../domain/input';

/** What the browser says is printed on each key, by `event.code`. Chromium only. */
let layoutMap: ReadonlyMap<string, string> | null = null;

/**
 * Without the Keyboard Map API (Firefox, Safari), a French or Belgian browser
 * is taken to mean AZERTY, the one layout common enough to guess. Only the
 * letters that differ from QWERTY are listed.
 */
const AZERTY_GUESS: Record<string, string> = { KeyW: 'Z', KeyA: 'Q', KeyQ: 'A', KeyZ: 'W', Semicolon: 'M', KeyM: ',' };
const guessAzerty = /^fr(-(FR|BE))?$/i.test(navigator.language);

type KeyboardWithLayout = { getLayoutMap(): Promise<ReadonlyMap<string, string>> };

/** Asks the browser for the keyboard layout once, at startup. Names fall back to a guess until it answers. */
export function loadPrintedKeys(onReady: () => void) {
    const keyboard = (navigator as Navigator & { keyboard?: KeyboardWithLayout }).keyboard;
    keyboard?.getLayoutMap()
        .then((map) => {
            layoutMap = map;
            onReady();
        })
        // Refused in some contexts (iframes, insecure origins): the guess stays.
        .catch(() => {});
}

/**
 * The name to print for a bound key, best source first: the browser's layout
 * map, then the character seen when the player bound it, then a guess from
 * the code (the defaults have no label: `KeyW` is Z on AZERTY).
 */
export function keyName(binding: KeyBinding): string {
    const printed = layoutMap?.get(binding.code);
    if (printed && [...printed].length === 1) return printed.toUpperCase();
    if (binding.label) return binding.label;
    if (!layoutMap && guessAzerty && AZERTY_GUESS[binding.code]) return AZERTY_GUESS[binding.code];
    return keyLabel(binding.code);
}
