import type { TriggerAction } from '../data/MapEntity';
import { events } from '../core/events';
import { createPersistentSet } from './persistence';

/** Tutorials already shown once: walking back through their trigger stays quiet. */
const seenTutorials = createPersistentSet('rpg-portfolio:seen-tutorials');

/**
 * One handler per action kind, same mapped-type trick as `chestLoot.ts`: a new
 * `TriggerAction` member fails the build until it gets its handler here.
 */
type TriggerHandlers = {
    [K in TriggerAction['kind']]: (action: Extract<TriggerAction, { kind: K }>) => void;
};

const handlers: TriggerHandlers = {
    tutorial: (action) => {
        if (seenTutorials.add(action.tutorialId)) events.emit('tutorialShown', action.tutorialId);
    },
};

export function runTriggerAction(action: TriggerAction) {
    handlers[action.kind](action as never);
}
