import { stateMachine } from './core/StateMachine';
import { events } from './core/events';
import { validateBook } from './domain/book';
import type { Experience } from './game/Experience';
import { initUIStateView } from './ui/UIStateView';
import { initMenuView } from './ui/views/MenuView';
import { initInteractPromptView } from './ui/views/InteractPromptView';
import { initBookView } from './ui/views/BookView';
import { initHudView } from './ui/views/HudView';
import { initTransitionView } from './ui/views/TransitionView';
import { initLoadingView } from './ui/views/LoadingView';
import { initEditorView } from './ui/views/EditorView';

validateBook();

/**
 * The live knight on the book's Level page. Shared like the game's own canvas: the book places
 * it on its page, the game draws into it, and neither has to know the other exists.
 */
const portraitCanvas = document.createElement('canvas');

initUIStateView();
initMenuView();
initInteractPromptView();
initBookView(portraitCanvas);
initHudView();
initTransitionView();
initLoadingView();
if (import.meta.env.DEV) initEditorView();

/** Share of the bar for downloading the game code; the models fill the rest. */
const CODE_SHARE = 0.3;
/** Past this the game starts anyway, with placeholders where models are still missing. */
const ASSET_TIMEOUT_MS = 12000;

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

/**
 * Game mode's real loading happens here, not at startup: the Three.js chunk is
 * only downloaded once someone picks it, and building the world is the slow
 * part. The loading screen covers exactly that wait, models included, so the
 * world is first seen with its real meshes instead of placeholders popping in.
 */
async function bootGame(): Promise<Experience> {
    document.body.classList.add('booting');
    events.emit('loadingProgress', 0);
    try {
        const [{ Experience }, { watchAssets }] = await Promise.all([
            import('./game/Experience'),
            import('./game/assetLoading'),
        ]);
        events.emit('loadingProgress', CODE_SHARE);

        const canvas = document.querySelector<HTMLCanvasElement>('canvas.webgl');
        if (!canvas) throw new Error('index.html is missing <canvas class="webgl">');

        // Before init: building the world is what requests the models.
        const assets = watchAssets();
        const experience = Experience.init(canvas, portraitCanvas);
        await assets.settled(
            (ratio) => events.emit('loadingProgress', CODE_SHARE + ratio * (1 - CODE_SHARE)),
            ASSET_TIMEOUT_MS,
        );
        events.emit('loadingProgress', 1);

        // Two frames: the first one renders the world, the second one puts it on screen.
        await nextFrame();
        await nextFrame();
        return experience;
    } finally {
        document.body.classList.remove('booting');
    }
}

let game: Promise<Experience> | null = null;

events.on('stateChange', (newState, oldState) => {
    // Every way in from the menu: the first one boots the game, later ones find it loaded.
    if (newState !== 'GAME' || oldState !== 'MENU') return;

    game ??= bootGame();
    game
        .then((experience) => experience.world.reveal())
        .catch((error) => {
            // Let the next click try again instead of replaying the same failure.
            game = null;
            console.error('[game] failed to start', error);
        });
});

// Nothing to load before the menu: the menu is plain DOM and game mode loads
// lazily. The old fixed 1.5 s wait only delayed recruiters for no reason.
stateMachine.changeState('MENU');
