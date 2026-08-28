import { events } from '../../core/events';
import { stateMachine } from '../../core/StateMachine';
import { getDiscoveryList } from '../../domain/discovery';
import { projectToUICardStyle } from '../../domain/CardStyle';
import { renderProjectCard } from '../components/renderProjectCard';

const TOGGLE_KEY = 'KeyB';

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

        const opening = !book.classList.contains('open');
        setOpen(opening);
        if (opening) render();
    });

    events.on('projectDiscovered', () => {
        if (book.classList.contains('open')) render();
    });
}
