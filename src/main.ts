import { stateMachine } from './core/StateMachine';
import { events } from './core/events';
import { initUIStateView } from './ui/UIStateView';
import { initMenuView } from './ui/views/MenuView';
import { initClassicView } from './ui/views/ClassicView';
import { initProjectModalView } from './ui/views/ProjectModalView';

initUIStateView();
initMenuView();
initClassicView();
initProjectModalView();

let gameLoaded = false;
events.on('stateChange', async (newState) => {
    if (newState !== 'GAME' || gameLoaded) return;
    gameLoaded = true;

    const { Experience } = await import('./game/Experience');
    const canvas = document.querySelector('canvas.webgl') as HTMLCanvasElement;
    Experience.init(canvas);
});

setTimeout(() => {
    stateMachine.changeState('MENU');
}, 1500);
