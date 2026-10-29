import type { LocalizedText } from './locale';
import type { InputAction } from './settings';

/**
 * One input on a tutorial page, drawn as keycaps. A key is its printed label
 * ('W', 'Space', '↑'), or 'MouseLeft' for the left mouse button.
 */
export interface ControlHint {
    keys: string[];
    label: LocalizedText;
    /** Rebindable inputs, one per key: the player's current keys are drawn instead of `keys`. */
    actions?: InputAction[];
    /** Four keys laid out like a keyboard's movement block: the first on top, the other three below. */
    shape?: 'cross';
}

/** A screenshot or drawing, path relative to `public/`. */
export interface BookImage {
    src: string;
    alt: LocalizedText;
    /** A square logo, shown whole and smaller instead of cropped to a 16:9 screenshot. */
    logo?: boolean;
}

/** A button under the page. Opens in a new tab, unless it is a `mailto:`. */
export interface BookLink {
    href: string;
    label: LocalizedText;
}

/** Free-form book pages. The section decides where (and in which mode) a page is shown. */
export interface BookPage {
    id: string;
    section: 'about' | 'tutorial';
    title: LocalizedText;
    /** Paragraphs separated by a blank line (`\n\n`). */
    body: LocalizedText;
    image?: BookImage;
    controls?: ControlHint[];
    /** Short extra pointers, one line each. */
    tips?: LocalizedText[];
    links?: BookLink[];
}
