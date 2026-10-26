import type { InputAction } from './settings';

/**
 * One input on a tutorial page, drawn as keycaps. A key is its printed label
 * ('W', 'Space', '↑'), or 'MouseLeft' for the left mouse button.
 */
export interface ControlHint {
    keys: string[];
    label: string;
    /** Rebindable inputs, one per key: the player's current keys are drawn instead of `keys`. */
    actions?: InputAction[];
    /** Four keys laid out like a keyboard's movement block: the first on top, the other three below. */
    shape?: 'cross';
}

/** Free-form book pages. The section decides where (and in which mode) a page is shown. */
export interface BookPage {
    id: string;
    section: 'about' | 'tutorial';
    title: string;
    body: string;
    /** A screenshot or drawing, path relative to `public/`. */
    image?: { src: string; alt: string };
    controls?: ControlHint[];
    /** Short extra pointers, one line each. */
    tips?: string[];
}
