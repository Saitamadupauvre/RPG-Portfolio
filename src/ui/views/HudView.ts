import { events } from '../../core/events';
import { getCoins } from '../../domain/playerProgress';
import { renderSprite } from '../components/pixelSprite';
import { COIN, HEART } from '../sprites';
import { playSound } from '../../audio/audio';

const TOAST_MS = 2600;
/** How long the chunk of bar just lost stays lit before it drains: what makes a hit readable. */
const TRAIL_DELAY_MS = 450;
const LOW_HP_RATIO = 0.3;
/** One tick mark on the bar per this much HP, so a longer bar also reads as more HP. */
const SEGMENT_HP = 20;
/** The bar grows with max HP (Vitality), capped so it never crosses the screen. */
const BAR_BASE_PX = 120;
const BAR_PX_PER_HP = 0.9;
const BAR_MAX_PX = 380;
/** The coin counter rolls toward its new value, faster per coin for big changes. */
const ROLL_MS_PER_COIN = 8;
const ROLL_MIN_MS = 300;
const ROLL_MAX_MS = 1100;

function requireElement(id: string): HTMLElement {
    const element = document.getElementById(id);
    if (!element) throw new Error(`index.html is missing #${id}`);
    return element;
}

const percent = (ratio: number) => `${Math.max(0, Math.min(1, ratio)) * 100}%`;
const formatCoins = (amount: number) => amount.toLocaleString('en-US');

/**
 * Restarts a one-shot CSS animation. Removing and re-adding the class in the
 * same frame does nothing: reading `offsetWidth` in between forces the browser
 * to apply the removal first.
 */
function replay(element: Element, className: string) {
    element.classList.remove(className);
    void (element as HTMLElement).offsetWidth;
    element.classList.add(className);
}

export function initHudView() {
    const health = requireElement('hud-health');
    const bar = requireElement('hp-bar');
    const fill = requireElement('hp-fill');
    const trail = requireElement('hp-trail');
    const label = requireElement('hp-label');
    const coins = requireElement('hud-coins');
    const count = requireElement('coin-count');
    const toast = requireElement('loot-toast');
    const vignette = requireElement('low-hp-vignette');

    requireElement('hud-heart').appendChild(renderSprite(HEART));
    const coin = renderSprite(COIN);
    requireElement('hud-coin').appendChild(coin);

    for (const element of [health, coins]) {
        element.addEventListener('animationend', (event) => {
            // The row's own animation, not one of its children's (the low-HP pulse loops and never ends).
            if (event.target === element) element.classList.remove('hurt', 'healed', 'gain', 'loss');
        });
    }
    // The spin steps the sheet inside the sprite, so its end comes from the child.
    coin.addEventListener('animationend', () => coin.classList.remove('spin'));

    // ---------- health ----------

    /** -1 until the first value arrives, which is drawn as is, without hit or heal effects. */
    let hp = -1;
    let maxHp = 0;
    let trailTimer = 0;

    events.on('playerHealthChanged', (nextHp, nextMax) => {
        const ratio = nextHp / nextMax;
        const damaged = hp >= 0 && nextHp < hp;
        const healed = hp >= 0 && nextHp > hp;

        if (nextMax !== maxHp) {
            bar.style.width = `${Math.min(BAR_MAX_PX, BAR_BASE_PX + nextMax * BAR_PX_PER_HP)}px`;
            bar.style.setProperty('--segments', String(nextMax / SEGMENT_HP));
        }

        fill.style.width = percent(ratio);
        // Hit again while the trail still shows the last hit: it keeps the older,
        // higher value and drains once, so a flurry reads as one big chunk.
        window.clearTimeout(trailTimer);
        if (damaged) trailTimer = window.setTimeout(() => (trail.style.width = percent(ratio)), TRAIL_DELAY_MS);
        else trail.style.width = percent(ratio);

        label.textContent = `${Math.ceil(nextHp)} / ${nextMax}`;
        if (damaged) replay(health, 'hurt');
        if (healed) replay(health, 'healed');

        const low = nextHp > 0 && ratio <= LOW_HP_RATIO;
        health.classList.toggle('low', low);
        vignette.classList.toggle('active', low);

        hp = nextHp;
        maxHp = nextMax;
    });

    // ---------- coins ----------

    /** The real amount, and the one on screen while the counter rolls toward it. */
    let target = getCoins();
    let shown = target;
    let rollFrame = 0;
    count.textContent = formatCoins(shown);

    const roll = (to: number) => {
        cancelAnimationFrame(rollFrame);
        const from = shown;
        const start = performance.now();
        const duration = Math.min(ROLL_MAX_MS, Math.max(ROLL_MIN_MS, Math.abs(to - from) * ROLL_MS_PER_COIN));

        const tick = (now: number) => {
            const t = Math.min(1, (now - start) / duration);
            shown = Math.round(from + (to - from) * (1 - (1 - t) ** 3));
            count.textContent = formatCoins(shown);
            if (t < 1) rollFrame = requestAnimationFrame(tick);
        };
        rollFrame = requestAnimationFrame(tick);
    };

    /** "+15" floating up from the counter, or "-240" sinking. */
    const popDelta = (delta: number) => {
        const pop = document.createElement('span');
        pop.className = `hud-coin-delta ${delta > 0 ? 'gain' : 'loss'}`;
        pop.textContent = `${delta > 0 ? '+' : '-'}${formatCoins(Math.abs(delta))}`;
        pop.addEventListener('animationend', () => pop.remove());
        coins.appendChild(pop);
    };

    events.on('coinsChanged', (amount) => {
        const delta = amount - target;
        target = amount;
        if (delta === 0) return;

        popDelta(delta);
        replay(coins, delta > 0 ? 'gain' : 'loss');
        if (delta > 0) {
            replay(coin, 'spin');
            playSound('coin');
        }
        roll(amount);
    });

    // ---------- loot toast ----------

    // One timer reused for every toast, so a second pickup restarts the countdown
    // instead of the first one hiding the second early.
    let toastTimer = 0;
    events.on('chestOpened', (messages) => {
        const lines = messages.length ? messages : ['Empty chest'];
        toast.replaceChildren(...lines.map((message) => {
            const line = document.createElement('span');
            line.className = 'hud-toast-line';
            line.textContent = message;
            return line;
        }));
        replay(toast, 'visible');

        window.clearTimeout(toastTimer);
        toastTimer = window.setTimeout(() => toast.classList.remove('visible'), TOAST_MS);
    });
}
