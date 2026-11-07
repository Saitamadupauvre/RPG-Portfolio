import type { MessageKey } from './i18n/en';

export type { MessageKey };

/** Every language the game is written in. The first one is the fallback. */
export const LOCALES = ['en', 'fr'] as const;

export type Locale = (typeof LOCALES)[number];

/** Names shown in the language switch, each in its own language: a reader looks for theirs. */
export const LOCALE_NAMES: Record<Locale, string> = {
    en: 'English',
    fr: 'Français',
};

/**
 * Authored content written once per language, side by side, so a translation
 * sits next to its original and a missing one fails the build.
 */
export type LocalizedText = Record<Locale, string>;

/**
 * A dictionary entry: a string with `{name}` placeholders, or one form per
 * plural category (`Intl.PluralRules`), picked by the `count` parameter.
 */
export type MessageText = string | { one: string; other: string };

/** A placeholder value. A nested `Message` is translated too (a stat name inside a loot line). */
export type MessageParam = string | number | Message;

/**
 * Text described, not written: the layer that knows a key (game, domain) hands
 * this to the UI, which translates it in the reader's current language.
 */
export type Message = { key: MessageKey; params?: Record<string, MessageParam> };
