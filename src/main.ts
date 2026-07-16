import { Experience } from './game/Experience';
import { stateMachine } from './core/StateMachine';
import { initUIStateView } from './ui/UIStateView';

const canvas = document.querySelector('canvas.webgl') as HTMLCanvasElement;
Experience.init(canvas);

initUIStateView();

setTimeout(() => {
    stateMachine.changeState('MENU');
}, 1500);
