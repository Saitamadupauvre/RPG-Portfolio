import { stateMachine } from './core/StateMachine';
import { events } from './core/events';
import { validateBook } from './domain/book';
import { initUIStateView } from './ui/UIStateView';
import { initMenuView } from './ui/views/MenuView';
import { initClassicView } from './ui/views/ClassicView';
import { initProjectModalView } from './ui/views/ProjectModalView';
import { initInteractPromptView } from './ui/views/InteractPromptView';
import { initBookView } from './ui/views/BookView';
import { initHudView } from './ui/views/HudView';
import { initUpgradeBoardView } from './ui/views/UpgradeBoardView';
import { initIrisView } from './ui/views/IrisView';
import { initEditorView } from './ui/views/EditorView';

validateBook();

initUIStateView();
initMenuView();
initClassicView();
initProjectModalView();
initInteractPromptView();
initBookView();
initHudView();
initUpgradeBoardView();
initIrisView();
if (import.meta.env.DEV) initEditorView();

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

/**
 * Game mode's real loading happens here, not at startup: the Three.js chunk is
 * only downloaded once someone picks it, and building the world is the slow
 * part. The loading screen covers exactly that wait.
 */
async function bootGame() {
    document.body.classList.add('booting');
    try {
        const { Experience } = await import('./game/Experience');
        const canvas = document.querySelector<HTMLCanvasElement>('canvas.webgl');
        if (!canvas) throw new Error('index.html is missing <canvas class="webgl">');

        Experience.init(canvas);
        // Two frames: the first one renders the world, the second one puts it on screen.
        await nextFrame();
        await nextFrame();
    } finally {
        document.body.classList.remove('booting');
    }
}

let gameLoaded = false;
events.on('stateChange', (newState) => {
    if (newState !== 'GAME' || gameLoaded) return;
    gameLoaded = true;

    bootGame().catch((error) => console.error('[game] failed to start', error));
});

// Nothing to load before the menu: the menu is plain DOM and game mode loads
// lazily. The old fixed 1.5 s wait only delayed recruiters for no reason.
stateMachine.changeState('MENU');
