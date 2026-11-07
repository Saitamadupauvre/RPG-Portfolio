import { events } from './events';
import { stateMachine } from './StateMachine';

/**
 * Who is holding the game paused right now. A set of reasons rather than one
 * boolean, for the same reason `MovementComponent.frozenBy` is: with a single
 * flag, one overlay closing would unpause the game under another one still
 * open.
 */
const reasons = new Set<string>();

export function setPaused(reason: string, paused: boolean) {
    const wasPaused = reasons.size > 0;

    if (paused) reasons.add(reason);
    else reasons.delete(reason);

    const isPausedNow = reasons.size > 0;
    if (isPausedNow !== wasPaused) events.emit('pauseChanged', isPausedNow);
}

export function isPaused(): boolean {
    return reasons.size > 0;
}

/** True when gameplay input should be acted on: in the game, nothing paused. */
export function isGameplayActive(): boolean {
    return stateMachine.getState() === 'GAME' && !isPaused();
}
