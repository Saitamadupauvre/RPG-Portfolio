import { events } from '../../core/events';
import { getIris } from '../components/iris';

/** The white flash at the moment of death, fading back to nothing. */
const FLASH_MS = 1100;
/** How long the death screen stays up before the world goes dark. */
const DEATH_HOLD_MS = 2600;
/** The fade to black that hides the player being moved to their bonfire. */
const COVER_MS = 500;
/** Resting at a bonfire: the circle shuts onto the player. */
const REST_CLOSE_MS = 600;
/** A beat of black before the circle opens: after a respawn, a rest, and after the loading screen fades out. */
const RESPAWN_BLACK_MS = 250;
const REST_BLACK_MS = 300;
const ENTER_BLACK_MS = 450;

function requireElement(id: string): HTMLElement {
    const element = document.getElementById(id);
    if (!element) throw new Error(`index.html is missing #${id}`);
    return element;
}

/**
 * Every full-screen transition of game mode, in one place because they hand
 * over to each other:
 *
 * - death: white flash, death screen over the frozen world, fade to black,
 *   then `respawnRequested` lets the world move the player;
 * - rest: the iris closes onto the player, then `restCovered` lets the world
 *   heal them and reset the enemies;
 * - respawn, rest and game entry: from black, the iris peeks at the player,
 *   then opens onto the whole screen.
 */
export function initTransitionView() {
    const iris = getIris();
    const flash = requireElement('death-flash');
    const deathScreen = requireElement('death-screen');
    const deathLoss = requireElement('death-loss');
    let deathTimer = 0;

    events.on('playerDied', (coinsLost) => {
        // Killed again while the last respawn was still opening: start over from a clear screen.
        iris.clear();
        window.clearTimeout(deathTimer);

        flash.getAnimations().forEach((animation) => animation.cancel());
        flash.animate([{ opacity: 1 }, { opacity: 0 }], {
            duration: FLASH_MS,
            easing: 'cubic-bezier(0.1, 0.6, 0.3, 1)',
        });

        deathLoss.textContent = coinsLost > 0 ? `${coinsLost.toLocaleString('en-US')} coins lost` : '';
        deathScreen.classList.add('visible');

        deathTimer = window.setTimeout(async () => {
            deathScreen.classList.remove('visible');
            if (await iris.cover(COVER_MS)) events.emit('respawnRequested');
        }, DEATH_HOLD_MS);
    });

    events.on('restStarted', async (x, y) => {
        // Answered even if something cut the close short: the world stays
        // paused until it hears back, so a dropped answer would freeze the game.
        await iris.close(x, y, REST_CLOSE_MS);
        events.emit('restCovered');
    });

    events.on('playerRespawned', (x, y) => {
        void iris.reveal(x, y, RESPAWN_BLACK_MS);
    });

    events.on('playerRested', (x, y) => {
        void iris.reveal(x, y, REST_BLACK_MS);
    });

    events.on('gameEntered', (x, y) => {
        void iris.reveal(x, y, ENTER_BLACK_MS);
    });
}
