import type { AppState } from './StateMachine';
import { EventEmitter } from './EventEmitter';

export type AppEvents = {
    stateChange: [newState: AppState, oldState: AppState];
};

export const events = new EventEmitter<AppEvents>();
