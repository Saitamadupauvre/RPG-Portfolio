import type { Project } from '../../data/Project';
import { findProject } from '../../data/projects';
import type { BookEntry, Lock } from '../../domain/book';
import { projectToUICardStyle } from '../../domain/CardStyle';
import { formatDate } from './formatDate';
import { renderLockIcon } from './renderBookToc';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string) {
    const element = document.createElement(tag);
    element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
}

function header(kicker: string, title: string, date?: string): HTMLElement {
    const head = el('header', 'book-entry-header');
    head.append(el('span', 'book-entry-kicker', kicker), el('h2', 'book-entry-title', title));
    if (date) head.appendChild(el('span', 'book-entry-date', date));
    return head;
}

function lockedNotice(text: string, lock: Lock): HTMLElement {
    const notice = el('div', 'book-entry-locked');
    notice.append(renderLockIcon(), el('p', 'book-entry-body', text));

    if (lock.locked && lock.total > 1) {
        const bar = el('div', 'book-progress');
        const fill = el('div', 'book-progress-fill');
        fill.style.width = `${(lock.found / lock.total) * 100}%`;
        bar.appendChild(fill);
        notice.append(bar, el('span', 'book-progress-label', `${lock.found}/${lock.total} projects found`));
    }
    return notice;
}

function link(href: string, label: string): HTMLAnchorElement {
    const anchor = el('a', 'book-link', label);
    anchor.href = href;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    return anchor;
}

function renderProject(project: Project, lock: Lock): HTMLElement[] {
    if (lock.locked) {
        return [
            header('Project', '???'),
            lockedNotice('Not yet found. Explore the world to reveal this project.', lock),
        ];
    }

    const style = projectToUICardStyle(project);
    const parts: HTMLElement[] = [
        header(`Project · ${style.badgeLabel}`, project.title, project.date && formatDate(project.date)),
        el('p', 'book-entry-body', project.description),
    ];

    if (project.tags.length > 0) {
        const tags = el('ul', 'book-tags');
        for (const tag of project.tags) tags.appendChild(el('li', 'book-tag', tag));
        parts.push(tags);
    }

    const links = el('div', 'book-links');
    if (project.links.demo) links.appendChild(link(project.links.demo, 'Live demo'));
    if (project.links.repo) links.appendChild(link(project.links.repo, 'Source code'));
    if (links.children.length > 0) parts.push(links);

    parts[0].classList.add(`rarity-${style.frameVariant}`);
    return parts;
}

function renderTimeline(entry: BookEntry & { kind: 'timeline' }): HTMLElement[] {
    const { event, lock } = entry;
    const parts = [header('Timeline', event.title, formatDate(event.date))];

    if (lock.locked) {
        parts.push(lockedNotice('Find the projects of this chapter to read it.', lock));
        return parts;
    }

    parts.push(el('p', 'book-entry-body', event.body));
    const related = event.projectIds.map(findProject).filter((p): p is Project => p !== undefined);
    if (related.length > 0) {
        const list = el('ul', 'book-tags');
        for (const project of related) list.appendChild(el('li', 'book-tag', project.title));
        parts.push(list);
    }
    return parts;
}

/** Content of the right-hand page. `undefined` = an empty section. */
export function renderBookEntry(entry: BookEntry | undefined): HTMLElement {
    const page = el('article', 'book-entry');

    if (!entry) {
        page.appendChild(el('p', 'book-empty', 'This page is blank.'));
        return page;
    }

    switch (entry.kind) {
        case 'project':
            page.append(...renderProject(entry.project, entry.lock));
            break;
        case 'timeline':
            page.append(...renderTimeline(entry));
            break;
        case 'page':
            page.append(header(entry.sectionId, entry.page.title), el('p', 'book-entry-body', entry.page.body));
            break;
    }
    return page;
}
