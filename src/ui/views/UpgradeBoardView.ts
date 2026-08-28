import { events } from '../../core/events';
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
            ...getStatViews().map((view) => renderRow(view, () => {
                // Buying re-renders so costs, levels and affordability stay honest.
                if (buyUpgrade(view.definition.id)) render();
            }))
        );
    };

    const setOpen = (open: boolean) => {
        board.classList.toggle('open', open);
        events.emit('pauseChanged', open);
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
