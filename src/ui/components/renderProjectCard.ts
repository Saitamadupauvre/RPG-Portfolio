import type { Project } from '../../data/Project';
import type { CardStyle } from '../../domain/CardStyle';

const LOCKED_TITLE = '???';
const LOCKED_DESCRIPTION = 'Not yet found. Explore the world to reveal this project.';

export function renderProjectCard(project: Project, cardStyle: CardStyle, locked = false): HTMLElement {
    const card = document.createElement('div');
    card.className = `project-card pixel-panel rarity-${cardStyle.frameVariant}`;
    if (cardStyle.glow && !locked) card.classList.add('glow');
    if (locked) card.classList.add('locked');

    const badge = document.createElement('span');
    badge.className = 'project-card-badge pixel-text';
    badge.textContent = cardStyle.badgeLabel;

    const title = document.createElement('h3');
    title.className = 'project-card-title';
    title.textContent = locked ? LOCKED_TITLE : project.title;

    const description = document.createElement('p');
    description.className = 'project-card-description';
    description.textContent = locked ? LOCKED_DESCRIPTION : project.description;

    const tags = document.createElement('div');
    tags.className = 'project-card-tags';
    if (!locked) {
        for (const tag of project.tags) {
            const tagEl = document.createElement('span');
            tagEl.className = 'project-card-tag';
            tagEl.textContent = tag;
            tags.appendChild(tagEl);
        }
    }

    card.append(badge, title, description, tags);
    return card;
}
