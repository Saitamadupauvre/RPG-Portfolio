import type { AppState } from './StateMachine';
import type { ItemEntity } from '../data/MapEntity';
import { EventEmitter } from './EventEmitter';

export type AppEvents = {
    stateChange: [newState: AppState, oldState: AppState];
    itemCollected: [item: ItemEntity];
};

export const events = new EventEmitter<AppEvents>();
