import { events } from '../../core/events';
import { getCoins } from '../../domain/playerProgress';

export function initHudView() {
    const fill = document.getElementById('hp-fill');
    const label = document.getElementById('hp-label');
    const coins = document.getElementById('coin-count');
    if (!fill || !label || !coins) return;

    const renderCoins = (amount: number) => {
        coins.textContent = `${amount} coins`;
    };

    renderCoins(getCoins());
    events.on('coinsChanged', renderCoins);

    events.on('playerHealthChanged', (hp, maxHp) => {
        const ratio = Math.max(0, hp / maxHp);
        fill.style.width = `${ratio * 100}%`;
        label.textContent = `${Math.ceil(hp)} / ${maxHp}`;
    });
}
