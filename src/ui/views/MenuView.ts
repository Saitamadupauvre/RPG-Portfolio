import { stateMachine } from '../../core/StateMachine';

export function initMenuView() {
    document.getElementById('btn-enter-game')?.addEventListener('click', () => {
        stateMachine.changeState('GAME');
    });

    document.getElementById('btn-enter-classic')?.addEventListener('click', () => {
        stateMachine.changeState('CLASSIC');
    });
}
