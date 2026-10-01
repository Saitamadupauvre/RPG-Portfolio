import { events } from '../../core/events';
import { setPaused } from '../../core/pause';
import { buyUpgrade, getCoins, getStatViews, type StatView } from '../../domain/playerProgress';

function renderRow(view: StatView, onBuy: () => void): HTMLElement {
    const { definition, level, value, nextValue, cost } = view;

    const row = document.createElement('div');
    row.className = 'upgrade-row pixel-panel';

    const info = document.createElement('div');
    info.className = 'upgrade-info';

    const name = document.createElement('span');
    name.className = 'upgrade-name pixel-text';
    name.textContent = `${definition.label}  Lv ${level}/${definition.maxLevel}`;

    const detail = document.createElement('span');
    detail.className = 'upgrade-detail';
    detail.textContent = nextValue === null
        ? `${definition.format(value)} — maxed`
        : `${definition.format(value)} → ${definition.format(nextValue)}`;

    info.append(name, detail);

    const button = document.createElement('button');
    button.className = 'btn upgrade-btn';
    button.textContent = cost === null ? 'MAX' : `${cost} coins`;
    button.disabled = !view.affordable;
    button.addEventListener('click', onBuy);

    row.append(info, button);
    return row;
}

export function initUpgradeBoardView() {
    const board = document.getElementById('upgrade-board');
    const list = document.getElementById('upgrade-list');
    const coinsLabel = document.getElementById('upgrade-coins');
    const closeBtn = document.getElementById('btn-close-upgrade');
    if (!board || !list || !coinsLabel || !closeBtn) return;

    const isOpen = () => board.classList.contains('open');

    const render = () => {
        coinsLabel.textContent = `${getCoins()} coins`;
        list.replaceChildren(
            // A successful buy emits coinsChanged, whose listener below re-renders
            // so costs, levels and affordability stay honest.
            ...getStatViews().map((view) => renderRow(view, () => buyUpgrade(view.definition.id)))
        );
    };

    const setOpen = (open: boolean) => {
        board.classList.toggle('open', open);
        setPaused('upgradeBoard', open);
        if (open) render();
    };

    closeBtn.addEventListener('click', () => setOpen(false));
    events.on('upgradeBoardRequested', () => setOpen(true));

    window.addEventListener('keydown', (event) => {
        if (event.code === 'Escape' && isOpen()) setOpen(false);
    });

    events.on('coinsChanged', () => {
        if (isOpen()) render();
    });
}
