import { t } from '../../domain/i18n';

const MOUSE_LEFT = 'MouseLeft';
const ARROWS = new Set(['←', '↑', '→', '↓']);

/**
 * A keycap for a printed key label ('E', 'Space', '↑'), or a little mouse with
 * its left button lit for 'MouseLeft'. Styled by `.book-key` / `.book-mouse`.
 */
export function renderKey(key: string): HTMLElement {
    if (key === MOUSE_LEFT) {
        const mouse = document.createElement('span');
        mouse.className = 'book-mouse';
        mouse.setAttribute('role', 'img');
        mouse.setAttribute('aria-label', t('key.mouseLeft'));
        const button = document.createElement('span');
        button.className = 'book-mouse-button';
        mouse.appendChild(button);
        return mouse;
    }
    const cap = document.createElement('kbd');
    cap.className = 'book-key';
    cap.textContent = key;
    // Arrows and letters are square caps; a named key ('Space') gets a long one.
    if ([...key].length > 1) cap.classList.add('book-key-wide');
    if (ARROWS.has(key)) cap.classList.add('book-key-arrow');
    return cap;
}
