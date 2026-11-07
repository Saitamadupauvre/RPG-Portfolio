import { stateMachine } from '@core/state/StateMachine';
import { events } from '@core/events/events';
import { LOCALE_NAMES, LOCALES, type Locale } from '@data/i18n/locale';
import { currentLocale, t } from '@domain/preferences/i18n';
import { setLanguage } from '@domain/preferences/settings';
import { getIris } from '@ui/components/iris';
import { isTouchOnly } from '@core/input/device';
import { enterGameFullscreen } from './TouchControlsView';
import { renderSprite } from '@ui/components/sprites/pixelSprite';
import { ARROW_POINT_LEFT, ARROW_POINT_RIGHT } from '@ui/components/sprites/sprites';

/** The fade to black before the world loads behind it. */
const ENTER_COVER_MS = 500;

/**
 * One button per language, the current one lit. Here as well as in the book's settings:
 * classic mode has no settings page, and a recruiter must be able to switch before reading.
 */
function initLanguageSwitch(host: HTMLElement) {
    const buttons = LOCALES.map((locale) => {
        const button = document.createElement('button');
        button.className = 'menu-lang-option';
        button.textContent = locale.toUpperCase();
        // Named in its own language, so a screen reader pronounces it right.
        button.lang = locale;
        button.setAttribute('aria-label', LOCALE_NAMES[locale]);
        button.addEventListener('click', () => setLanguage(locale));
        return button;
    });
    host.replaceChildren(...buttons);

    const light = (current: Locale) => {
        LOCALES.forEach((locale, i) => {
            buttons[i].classList.toggle('active', locale === current);
            buttons[i].setAttribute('aria-pressed', String(locale === current));
        });
    };
    light(currentLocale());
    events.on('languageChanged', light);
}

export function initMenuView() {
    const enterGame = document.getElementById('btn-enter-game');
    let entering = false;
    // Until the world stands behind the menu, entering the game means a load: a fade to black covers it.
    let worldReady = false;

    for (const slot of document.querySelectorAll('#menu-screen [data-arrow]')) {
        slot.appendChild(renderSprite(ARROW_POINT_RIGHT));
    }
    document.getElementById('menu-callout-arrow')?.appendChild(renderSprite(ARROW_POINT_LEFT));

    const languageSwitch = document.getElementById('menu-lang');
    if (languageSwitch) initLanguageSwitch(languageSwitch);

    // A touch-only device boots the world only once Play is picked (main.ts), and plays it held sideways.
    if (isTouchOnly()) {
        document.body.classList.add('touch-only');
        const hint = enterGame?.querySelector<HTMLElement>('.menu-btn-hint');
        if (hint) {
            // Through its key, so a language switch rewrites this text too (staticText.ts).
            hint.dataset.i18n = 'menu.play.touchHint';
            hint.textContent = t('menu.play.touchHint');
        }
    }

    events.on('worldReady', () => {
        worldReady = true;
        // The backdrop fades in under the menu; CSS keys off this class.
        document.body.classList.add('world-ready');
    });

    enterGame?.addEventListener('click', async () => {
        // A second click while the screen fades would start a second entry.
        if (entering) return;
        // First, while the browser still counts this as the tap's own handler.
        enterGameFullscreen();

        // Loaded: the menu fades out while the camera glides down into the game.
        if (worldReady) {
            stateMachine.changeState('GAME');
            return;
        }

        entering = true;
        // A fade, not the circle: the circle would open on the camera mid-glide.
        await getIris().cover(ENTER_COVER_MS);
        // Even if the world got ready during the fade: the screen is black, so the
        // game cuts to its gameplay shot and fades in, rather than glide.
        events.emit('gameEntryCovered');
        stateMachine.changeState('GAME');
        entering = false;
    });

    document.getElementById('btn-enter-classic')?.addEventListener('click', () => {
        stateMachine.changeState('CLASSIC');
    });
}
