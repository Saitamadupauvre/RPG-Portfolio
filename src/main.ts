import { stateMachine } from './core/StateMachine';
import { events } from './core/events';
import { initUIStateView } from './ui/UIStateView';
import { initMenuView } from './ui/views/MenuView';
import { initClassicView } from './ui/views/ClassicView';
import { initProjectModalView } from './ui/views/ProjectModalView';
import { initInteractPromptView } from './ui/views/InteractPromptView';
import { initBookView } from './ui/views/BookView';
import { initHudView } from './ui/views/HudView';
import { initIrisView } from './ui/views/IrisView';
import { initEditorView } from './ui/views/EditorView';

initUIStateView();
initMenuView();
initClassicView();
initProjectModalView();
initInteractPromptView();
initBookView();
initHudView();
initIrisView();
if (import.meta.env.DEV) initEditorView();

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
