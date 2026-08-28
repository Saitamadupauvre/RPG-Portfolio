import { events } from '../../core/events';
import { projectToUICardStyle } from '../../domain/CardStyle';
import { renderProjectCard } from '../components/renderProjectCard';

export function initProjectModalView() {
    const modal = document.getElementById('project-modal');
    const body = document.getElementById('project-modal-body');
    const closeBtn = document.getElementById('btn-close-modal');
    if (!modal || !body || !closeBtn) return;

    const close = () => modal.classList.remove('open');
    closeBtn.addEventListener('click', close);

    events.on('projectDiscovered', (project) => {
        body.replaceChildren(renderProjectCard(project, projectToUICardStyle(project)));
        modal.classList.add('open');
    });
}
