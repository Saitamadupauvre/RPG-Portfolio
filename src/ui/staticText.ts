import { events } from '../core/events';
import { currentLocale, isMessageKey, t } from '../domain/i18n';

/**
 * The text written in index.html, rewritten in the current language. An element
 * names its key in `data-i18n` (its text) or `data-i18n-aria-label` (its label),
 * so only leaf elements carry `data-i18n`: setting the text replaces children.
 * The English in the HTML is what shows before this runs.
 */
export function initStaticText() {
    const translateKey = (key: string | undefined) => {
        if (!key || !isMessageKey(key)) throw new Error(`index.html names an unknown message key "${key}"`);
        return t(key);
    };

    const apply = () => {
        document.documentElement.lang = currentLocale();
        for (const element of document.querySelectorAll<HTMLElement>('[data-i18n]')) {
            element.textContent = translateKey(element.dataset.i18n);
        }
        for (const element of document.querySelectorAll<HTMLElement>('[data-i18n-aria-label]')) {
            element.setAttribute('aria-label', translateKey(element.dataset.i18nAriaLabel));
        }
    };

    apply();
    events.on('languageChanged', apply);
}
