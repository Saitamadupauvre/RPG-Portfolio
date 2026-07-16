import { events } from './events';

export type AppState = 'LOADING' | 'MENU' | 'GAME' | 'CLASSIC';

class StateMachine {
    private currentState: AppState = 'LOADING';

    public changeState(newState: AppState) {
        const oldState = this.currentState;
        console.log(`[State] Transition: ${oldState} -> ${newState}`);
        this.currentState = newState;
        events.emit('stateChange', newState, oldState);
    }

    public getState(): AppState {
        return this.currentState;
    }
}

export const stateMachine = new StateMachine();
