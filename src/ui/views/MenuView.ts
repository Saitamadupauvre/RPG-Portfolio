import { stateMachine } from '../../core/StateMachine';
import { events } from '../../core/events';
import { getIris } from '../components/iris';
import { renderSprite } from '../components/pixelSprite';
import { ARROW_POINT_LEFT, ARROW_POINT_RIGHT } from '../sprites';

/** The circle closing onto the Game button before the world loads behind it. */
const ENTER_CLOSE_MS = 650;

export function initMenuView() {
    const enterGame = document.getElementById('btn-enter-game');
    let entering = false;
    // Until the world stands behind the menu, entering the game means a load: the iris covers it.
    let worldReady = false;

    for (const slot of document.querySelectorAll('#menu-screen [data-arrow]')) {
        slot.appendChild(renderSprite(ARROW_POINT_RIGHT));
    }
    document.getElementById('menu-callout-arrow')?.appendChild(renderSprite(ARROW_POINT_LEFT));

    events.on('worldReady', () => {
        worldReady = true;
        // The backdrop fades in under the menu; CSS keys off this class.
        document.body.classList.add('world-ready');
    });

    enterGame?.addEventListener('click', async () => {
        // A second click while the circle closes would start a second entry.
        if (entering) return;

        // Loaded: the menu fades out while the camera glides down into the game.
        if (worldReady) {
            stateMachine.changeState('GAME');
            return;
        }

        entering = true;
        const { left, top, width, height } = enterGame.getBoundingClientRect();
        await getIris().close(left + width / 2, top + height / 2, ENTER_CLOSE_MS);
        stateMachine.changeState('GAME');
        entering = false;
    });

    document.getElementById('btn-enter-classic')?.addEventListener('click', () => {
        stateMachine.changeState('CLASSIC');
    });
}
