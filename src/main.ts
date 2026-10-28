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
import { initAudio, setVolume } from './audio/audio';
import { getSettings } from './domain/settings';
import { VOLUME_CHANNELS, type VolumeChannel } from './data/settings';
import type { AudioBus } from './data/sounds';

validateBook();
initAudio();

/** Which buses each volume slider drives: UI sounds follow the effects. */
const CHANNEL_BUSES: Record<VolumeChannel, readonly AudioBus[]> = {
    music: ['music'],
    sfx: ['sfx', 'ui'],
};
const applyVolume = (channel: VolumeChannel, volume: number) => {
    for (const bus of CHANNEL_BUSES[channel]) setVolume(bus, volume);
};
for (const channel of VOLUME_CHANNELS) applyVolume(channel, getSettings().volume[channel]);
events.on('volumeChanged', applyVolume);

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
 * Game mode's real loading: the Three.js chunk, the world and its models. It
 * starts as soon as the menu is up, in the background, so the world can stand
 * behind the menu; the loading screen only shows if someone picks Game before
 * it is done. The classic book never waits on any of it.
 */
async function bootGame(): Promise<Experience> {
    events.emit('loadingProgress', 0);
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
}

let game: Promise<Experience> | null = null;
let ready = false;

function startBoot(): Promise<Experience> {
    game ??= bootGame().then(
        (experience) => {
            ready = true;
            events.emit('worldReady');
            return experience;
        },
        (error: unknown) => {
            // Let the next click try again instead of replaying the same failure.
            game = null;
            throw error;
        },
    );
    return game;
}

events.on('stateChange', (newState, oldState) => {
    // Every way in from the menu. Once the world stands behind the menu, the
    // camera glides from the menu shot into the game: nothing to wait for.
    if (newState !== 'GAME' || oldState !== 'MENU' || ready) return;

    // Picked before the background boot was done: cover the rest of the wait.
    document.body.classList.add('booting');
    startBoot()
        .then((experience) => experience.world.reveal())
        .catch((error: unknown) => console.error('[game] failed to start', error))
        .finally(() => document.body.classList.remove('booting'));
});

// Nothing to load before the menu: it is plain DOM, and the world loads behind it.
stateMachine.changeState('MENU');
// After the menu's first paint, so the title and buttons never wait on the game's download.
requestAnimationFrame(() => {
    startBoot().catch((error: unknown) => console.error('[game] failed to load the world', error));
});
