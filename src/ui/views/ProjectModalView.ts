import { events } from '../../core/events';
import { projectToUICardStyle } from '../../domain/CardStyle';
import { renderProjectCard } from '../components/renderProjectCard';

export function initProjectModalView() {
    const modal = document.getElementById('project-modal');
    const body = document.getElementById('project-modal-body');
    const closeBtn = document.getElementById('btn-close-modal');
    if (!modal || !body || !closeBtn) return;

    const setOpen = (open: boolean) => {
        modal.classList.toggle('open', open);
        events.emit('pauseChanged', open);
    };

    const close = () => setOpen(false);
    closeBtn.addEventListener('click', close);

    window.addEventListener('keydown', (event) => {
        if (event.code === 'Escape' && modal.classList.contains('open')) {
            close();
        }
    });

    events.on('projectDiscovered', (project) => {
        body.replaceChildren(renderProjectCard(project, projectToUICardStyle(project)));
        setOpen(true);
    });
}
