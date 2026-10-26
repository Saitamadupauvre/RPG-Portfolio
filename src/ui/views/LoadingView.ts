import { events } from '../../core/events';
import { loadingTips } from '../../data/loadingTips';
import { renderSprite } from '../components/pixelSprite';
import { CAMPFIRE } from '../sprites';

const TIP_MS = 4200;
const EMBERS = 14;

function requireElement(id: string): HTMLElement {
    const element = document.getElementById(id);
    if (!element) throw new Error(`index.html is missing #${id}`);
    return element;
}

/** Sparks rising off the bottom of the screen, each on its own course and timing. */
function scatterEmbers(host: HTMLElement) {
    for (let i = 0; i < EMBERS; i++) {
        const ember = document.createElement('span');
        ember.className = 'loading-ember';
        ember.style.left = `${Math.random() * 100}%`;
        ember.style.setProperty('--drift', `${(Math.random() - 0.5) * 120}px`);
        ember.style.animationDuration = `${5 + Math.random() * 5}s`;
        ember.style.animationDelay = `${-Math.random() * 10}s`;
        host.appendChild(ember);
    }
}

export function initLoadingView() {
    const fill = requireElement('progress-fill');
    const percent = requireElement('loading-percent');
    const tip = requireElement('loading-tip');

    requireElement('loading-fire').appendChild(renderSprite(CAMPFIRE, 'sprite-play'));
    scatterEmbers(requireElement('loading-embers'));

    let shown = 0;
    let tipIndex = Math.floor(Math.random() * loadingTips.length);
    let tipTimer = 0;

    const showTip = () => {
        tip.textContent = loadingTips[tipIndex % loadingTips.length] ?? '';
        tip.classList.remove('fresh');
        void tip.offsetWidth;
        tip.classList.add('fresh');
        tipIndex++;
    };

    events.on('loadingProgress', (progress) => {
        // 0 starts a load. After that the bar only moves forward: the asset
        // count grows as files are found, and a bar going back reads as broken.
        if (progress === 0) {
            shown = 0;
            showTip();
            window.clearInterval(tipTimer);
            tipTimer = window.setInterval(showTip, TIP_MS);
        }
        shown = Math.max(shown, Math.min(1, progress));
        if (shown >= 1) window.clearInterval(tipTimer);

        fill.style.width = `${shown * 100}%`;
        percent.textContent = `${Math.round(shown * 100)}%`;
    });
}
