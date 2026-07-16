import type { Project } from '../../data/Project';
import type { CardStyle } from '../../domain/CardStyle';

export function renderProjectCard(project: Project, cardStyle: CardStyle): HTMLElement {
    const card = document.createElement('div');
    card.className = `project-card pixel-panel rarity-${cardStyle.frameVariant}`;
    if (cardStyle.glow) card.classList.add('glow');

    const badge = document.createElement('span');
    badge.className = 'project-card-badge pixel-text';
    badge.textContent = cardStyle.badgeLabel;

    const title = document.createElement('h3');
    title.className = 'project-card-title';
    title.textContent = project.title;

    const description = document.createElement('p');
    description.className = 'project-card-description';
    description.textContent = project.description;

    const tags = document.createElement('div');
    tags.className = 'project-card-tags';
    for (const tag of project.tags) {
        const tagEl = document.createElement('span');
        tagEl.className = 'project-card-tag';
        tagEl.textContent = tag;
        tags.appendChild(tagEl);
    }

    card.append(badge, title, description, tags);
    return card;
}
