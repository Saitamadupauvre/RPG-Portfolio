import { stateMachine } from '../../core/StateMachine';
import { getIris } from '../components/iris';

/** The circle closing onto the Game button before the world loads behind it. */
const ENTER_CLOSE_MS = 650;

export function initMenuView() {
    const enterGame = document.getElementById('btn-enter-game');
    let entering = false;

    enterGame?.addEventListener('click', async () => {
        // A second click while the circle closes would start a second entry.
        if (entering) return;
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
