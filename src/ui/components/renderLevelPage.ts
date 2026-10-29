import { formatNumber, t } from '../../domain/i18n';
import {
    getCoins,
    getStatViews,
    type StatDefinition,
    type StatId,
    type StatView,
} from '../../domain/playerProgress';

export type LevelPageContext = {
    /** True at a bonfire: the only place stats can be bought. */
    canLevelUp: boolean;
    onBuy: (id: StatId) => void;
};

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string) {
    const element = document.createElement(tag);
    element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
}

/** Sum of every stat level, shown as the player's overall level (starts at 1). */
function playerLevel(views: StatView[]): number {
    return 1 + views.reduce((sum, view) => sum + view.level, 0);
}

/**
 * Left-hand page of the Level section: the player instead of a table of contents. `portrait` is
 * the one canvas the game draws the live knight into: appending it moves it here from the page
 * the last render built, it is never copied.
 */
export function renderPlayerPage(portrait: HTMLCanvasElement): HTMLElement {
    portrait.className = 'book-portrait';
    const frame = el('div', 'book-player');
    frame.appendChild(portrait);

    const page = el('div', 'book-player-page');
    page.append(
        el('h2', 'book-page-title', t('level.title', { level: playerLevel(getStatViews()) })),
        frame,
        el('p', 'book-player-coins', t('level.coins', { count: getCoins() })),
    );
    return page;
}

/** One square per level, filled up to the current one: reads at a glance, like a gauge. */
function renderPips(view: StatView): HTMLElement {
    const pips = el('div', 'book-stat-pips');
    for (let i = 0; i < view.definition.maxLevel; i++) {
        pips.appendChild(el('span', i < view.level ? 'book-stat-pip filled' : 'book-stat-pip'));
    }
    return pips;
}

function renderBuyButton(view: StatView, onBuy: () => void): HTMLElement {
    const label = view.cost === null ? t('level.max') : t('level.buy', { cost: view.cost });
    const button = el('button', 'book-link book-stat-buy', label);
    button.disabled = !view.affordable;
    button.addEventListener('click', onBuy);
    return button;
}

/** A stat value with its unit: `4.3 SPD`, `4,3 VIT` in French. */
const formatStat = (definition: StatDefinition, value: number) =>
    t(`stat.${definition.id}.value`, { value: formatNumber(value, definition.decimals) });

function renderStat(view: StatView, context: LevelPageContext): HTMLElement {
    const { definition, level, value, nextValue } = view;
    const row = el('div', 'book-stat');

    const head = el('div', 'book-stat-head');
    head.append(
        el('span', 'book-stat-name', t(`stat.${definition.id}.name`)),
        el('span', 'book-stat-level', t('level.rank', { level, max: definition.maxLevel })),
    );

    const detail = nextValue === null
        ? t('level.maxed', { value: formatStat(definition, value) })
        : t('level.next', { value: formatStat(definition, value), next: formatStat(definition, nextValue) });

    row.append(head, renderPips(view), el('span', 'book-stat-value', detail));
    if (context.canLevelUp) row.appendChild(renderBuyButton(view, () => context.onBuy(definition.id)));
    return row;
}

/** Right-hand page of the Level section: every stat, buyable only at a bonfire. */
export function renderStatsPage(context: LevelPageContext): HTMLElement {
    const page = el('article', 'book-entry');

    const head = el('header', 'book-entry-header');
    head.append(el('span', 'book-entry-kicker', t('level.kicker')), el('h2', 'book-entry-title', t('level.heading')));
    page.appendChild(head);

    const list = el('div', 'book-stats');
    for (const view of getStatViews()) list.appendChild(renderStat(view, context));
    page.appendChild(list);

    if (!context.canLevelUp) {
        page.appendChild(el('p', 'book-stat-hint', t('level.hint')));
    }
    return page;
}
