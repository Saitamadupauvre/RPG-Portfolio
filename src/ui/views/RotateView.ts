import { events } from '@core/events/events';
import { setPaused } from '@core/state/pause';
import { stateMachine, type AppState } from '@core/state/StateMachine';
import { renderSprite } from '@ui/components/sprites/pixelSprite';
import { isTouchOnly } from '@core/input/device';
import { PHONE_TURN } from '@ui/components/sprites/sprites';

/** The states where the world is on screen and the player is in it. */
const PLAYING_STATES: readonly AppState[] = ['GAME', 'DEAD'];

/**
 * A phone held upright in the game: a portrait screen shows a third of the
 * landscape width (the camera's 75° is vertical), and the sides are where the
 * archers and the dragon come from. The game pauses behind a "turn your phone"
 * screen until it is held sideways.
 *
 * One decision for both halves: this module toggles `body.rotate-needed`, the
 * CSS only reads it, so the screen and the pause can never disagree.
 */
export function initRotateView() {
    // Not only phones: a tablet without a keyboard plays by touch too, and a desktop window is never asked.
    if (!isTouchOnly()) return;

    document.getElementById('rotate-phone')?.appendChild(renderSprite(PHONE_TURN, 'sprite-play'));

    const portrait = window.matchMedia('(orientation: portrait)');

    const update = () => {
        const needed = portrait.matches && PLAYING_STATES.includes(stateMachine.getState());
        document.body.classList.toggle('rotate-needed', needed);
        setPaused('orientation', needed);
    };

    portrait.addEventListener('change', update);
    events.on('stateChange', update);
    update();
}
