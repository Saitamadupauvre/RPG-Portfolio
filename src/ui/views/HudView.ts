import { events } from '../../core/events';

// Player HP bar. Width-only updates (no re-render) so damage never touches the DOM tree,
// just one style property — cheap enough to run on every hit.
export function initHudView() {
    const fill = document.getElementById('hp-fill');
    const label = document.getElementById('hp-label');
    if (!fill || !label) return;

    events.on('playerHealthChanged', (hp, maxHp) => {
        const ratio = Math.max(0, hp / maxHp);
        fill.style.width = `${ratio * 100}%`;
        label.textContent = `${Math.ceil(hp)} / ${maxHp}`;
    });
}
