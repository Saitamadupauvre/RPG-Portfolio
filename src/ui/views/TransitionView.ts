import { events } from '../../core/events';
import { getIris } from '../components/iris';

/** Dying: once the body has faded, the circle shuts slowly onto where it lay. */
const DEATH_CLOSE_MS = 1100;
/** Resting at a bonfire: the circle shuts onto the player. */
const REST_CLOSE_MS = 600;
/** A beat of black before the circle opens: after a respawn, a rest, and after the loading screen fades out. */
const RESPAWN_BLACK_MS = 250;
const REST_BLACK_MS = 300;
const ENTER_BLACK_MS = 450;

/**
 * Every full-screen transition of game mode, in one place because they hand
 * over to each other:
 *
 * - death: once the player's body has faded, the iris closes onto where it
 *   lay, then `respawnRequested` lets the world move the player;
 * - rest: the iris closes onto the player, then `restCovered` lets the world
 *   heal them and reset the enemies;
 * - respawn, rest and game entry: from black, the iris peeks at the player,
 *   then opens onto the whole screen.
 */
export function initTransitionView() {
    const iris = getIris();

    // Killed again while the last respawn was still opening: the body fades on a clear screen.
    events.on('playerDied', () => iris.clear());

    events.on('playerFaded', async (x, y) => {
        if (await iris.close(x, y, DEATH_CLOSE_MS)) events.emit('respawnRequested');
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
