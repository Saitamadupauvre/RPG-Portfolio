import { en } from '../data/i18n/en';
import { fr } from '../data/i18n/fr';
import type { Locale, LocalizedText, Message, MessageKey, MessageParam, MessageText } from '../data/locale';
import { getSettings } from './settings';

export type { Locale, LocalizedText, Message, MessageKey };

type Params = Record<string, MessageParam>;

const DICTIONARIES: Record<Locale, Record<MessageKey, MessageText>> = { en, fr };

/** Read on every call, never cached: a language switch applies to the next text drawn. */
export const currentLocale = (): Locale => getSettings().language;

// `Intl` objects are costly to build and the interface formats on every redraw: built once each.
const pluralRules = new Map<Locale, Intl.PluralRules>();
const numberFormats = new Map<string, Intl.NumberFormat>();

/** A number in the current language: `4.3` reads `4,3` in French. `decimals` fixes the digits shown. */
export function formatNumber(value: number, decimals?: number): string {
    const locale = currentLocale();
    const key = `${locale}:${decimals ?? ''}`;
    let format = numberFormats.get(key);
    if (!format) {
        format = new Intl.NumberFormat(locale, {
            // No grouping: French groups with a narrow no-break space, a glyph the pixel fonts lack.
            useGrouping: false,
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
        });
        numberFormats.set(key, format);
    }
    return format.format(value);
}

function formatParam(param: MessageParam): string {
    if (typeof param === 'number') return formatNumber(param);
    if (typeof param === 'string') return param;
    return translate(param);
}

function pickForm(text: MessageText, params: Params | undefined, locale: Locale): string {
    if (typeof text === 'string') return text;
    let rules = pluralRules.get(locale);
    if (!rules) {
        rules = new Intl.PluralRules(locale);
        pluralRules.set(locale, rules);
    }
    return rules.select(Number(params?.count ?? 0)) === 'one' ? text.one : text.other;
}

/**
 * The interface string for `key` in the current language, `{name}` filled from
 * `params`. A placeholder with no parameter is left as is, so a typo shows on
 * screen instead of vanishing.
 */
export function t(key: MessageKey, params?: Params): string {
    const locale = currentLocale();
    const text = pickForm(DICTIONARIES[locale][key], params, locale);
    if (!params) return text;
    return text.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
        name in params ? formatParam(params[name]) : placeholder,
    );
}

export const translate = (message: Message): string => t(message.key, message.params);

/** The current language's version of authored content. */
export const localize = (text: LocalizedText): string => text[currentLocale()];

/** Own keys only: `'toString' in en` is true too. */
export const isMessageKey = (key: string): key is MessageKey => Object.hasOwn(en, key);
