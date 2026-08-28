import { events } from '../../core/events';
import { stateMachine } from '../../core/StateMachine';
import { getDiscoveryList } from '../../domain/discovery';
import { projectToUICardStyle } from '../../domain/CardStyle';
import { renderProjectCard } from '../components/renderProjectCard';

const TOGGLE_KEY = 'KeyB';

// In-game project book. Same cards as classic mode, different frame — undiscovered
// entries render locked. Purely a UI toggle, so the key is handled here rather than
// routed through the game layer.
export function initBookView() {
    const book = document.getElementById('book');
    const list = document.getElementById('book-list');
    const closeBtn = document.getElementById('btn-close-book');
    if (!book || !list || !closeBtn) return;

    const render = () => {
        list.replaceChildren(
            ...getDiscoveryList().map(({ project, discovered }) =>
                renderProjectCard(project, projectToUICardStyle(project), !discovered)
            )
        );
    };

    // Reading the book freezes the world, so an enemy can't kill you while you browse.
    const setOpen = (open: boolean) => {
        book.classList.toggle('open', open);
        events.emit('pauseChanged', open);
    };

    const close = () => setOpen(false);
    closeBtn.addEventListener('click', close);

    window.addEventListener('keydown', (event) => {
        if (event.code === 'Escape' && book.classList.contains('open')) {
            close();
            return;
        }

        if (event.code !== TOGGLE_KEY || event.repeat) return;
        if (stateMachine.getState() !== 'GAME') return;

        // Rendering on open (not on every discovery) keeps the DOM work off the game loop
        // and guarantees the list is current whenever it's actually visible.
        const opening = !book.classList.contains('open');
        setOpen(opening);
        if (opening) render();
    });

    // A discovery while the book is open should show up immediately.
    events.on('projectDiscovered', () => {
        if (book.classList.contains('open')) render();
    });
}
