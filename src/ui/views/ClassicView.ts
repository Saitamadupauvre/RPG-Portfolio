import { events } from '../../core/events';
import { stateMachine } from '../../core/StateMachine';
import { projects } from '../../data/projects';
import { projectToUICardStyle } from '../../domain/CardStyle';
import { renderProjectCard } from '../components/renderProjectCard';

export function initClassicView() {
    const list = document.getElementById('classic-project-list');
    const backBtn = document.getElementById('btn-classic-back');
    if (!list) return;

    backBtn?.addEventListener('click', () => {
        stateMachine.changeState('MENU');
    });

    let rendered = false;

    events.on('stateChange', (newState) => {
        if (newState !== 'CLASSIC' || rendered) return;
        rendered = true;

        for (const project of projects) {
            list.appendChild(renderProjectCard(project, projectToUICardStyle(project)));
        }
    });
}
