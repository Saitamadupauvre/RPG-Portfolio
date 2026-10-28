import { stateMachine } from '../../core/StateMachine';
import { events } from '../../core/events';
import { getIris } from '../components/iris';
import { isTouchOnly } from '../device';
import { renderSprite } from '../components/pixelSprite';
import { ARROW_POINT_LEFT, ARROW_POINT_RIGHT } from '../sprites';

/** The fade to black before the world loads behind it. */
const ENTER_COVER_MS = 500;

export function initMenuView() {
    const enterGame = document.getElementById('btn-enter-game');
    let entering = false;
    // Until the world stands behind the menu, entering the game means a load: a fade to black covers it.
    let worldReady = false;

    for (const slot of document.querySelectorAll('#menu-screen [data-arrow]')) {
        slot.appendChild(renderSprite(ARROW_POINT_RIGHT));
    }
    document.getElementById('menu-callout-arrow')?.appendChild(renderSprite(ARROW_POINT_LEFT));

    // No world boots on a touch-only device (main.ts): the game stays on the menu, greyed, so it is not a surprise.
    if (isTouchOnly()) {
        document.body.classList.add('touch-only');
        if (enterGame instanceof HTMLButtonElement) enterGame.disabled = true;
        const hint = enterGame?.querySelector('.menu-btn-hint');
        if (hint) hint.textContent = 'Needs a keyboard and mouse: open it on a computer';
    }

    events.on('worldReady', () => {
        worldReady = true;
        // The backdrop fades in under the menu; CSS keys off this class.
        document.body.classList.add('world-ready');
    });

    enterGame?.addEventListener('click', async () => {
        // A second click while the screen fades would start a second entry.
        if (entering) return;

        // Loaded: the menu fades out while the camera glides down into the game.
        if (worldReady) {
            stateMachine.changeState('GAME');
            return;
        }

        entering = true;
        // A fade, not the circle: the circle would open on the camera mid-glide.
        await getIris().cover(ENTER_COVER_MS);
        // Even if the world got ready during the fade: the screen is black, so the
        // game cuts to its gameplay shot and fades in, rather than glide.
        events.emit('gameEntryCovered');
        stateMachine.changeState('GAME');
        entering = false;
    });

    document.getElementById('btn-enter-classic')?.addEventListener('click', () => {
        stateMachine.changeState('CLASSIC');
    });
}
