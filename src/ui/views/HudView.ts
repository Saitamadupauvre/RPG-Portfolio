import { events } from '../../core/events';
import { getCoins } from '../../domain/playerProgress';

const TOAST_MS = 2600;

export function initHudView() {
    const fill = document.getElementById('hp-fill');
    const label = document.getElementById('hp-label');
    const coins = document.getElementById('coin-count');
    const toast = document.getElementById('loot-toast');
    if (!fill || !label || !coins || !toast) return;

    const renderCoins = (amount: number) => {
        coins.textContent = `${amount} coins`;
    };

    renderCoins(getCoins());
    events.on('coinsChanged', renderCoins);

    // One timer reused for every toast, so a second pickup restarts the countdown
    // instead of the first one hiding the second early.
    let toastTimer = 0;
    events.on('chestOpened', (messages) => {
        toast.textContent = messages.length ? messages.join('  |  ') : 'Empty chest';
        toast.classList.add('visible');

        window.clearTimeout(toastTimer);
        toastTimer = window.setTimeout(() => toast.classList.remove('visible'), TOAST_MS);
    });

    events.on('playerHealthChanged', (hp, maxHp) => {
        const ratio = Math.max(0, hp / maxHp);
        fill.style.width = `${ratio * 100}%`;
        label.textContent = `${Math.ceil(hp)} / ${maxHp}`;
    });
}
