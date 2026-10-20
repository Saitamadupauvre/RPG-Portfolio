import type { BookPage, ControlHint } from '../../data/BookPage';
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

const MOUSE_LEFT = 'MouseLeft';
const ARROWS = new Set(['←', '↑', '→', '↓']);

/** A keycap, or a little mouse with its left button lit. */
function renderKey(key: string): HTMLElement {
    if (key === MOUSE_LEFT) {
        const mouse = el('span', 'book-mouse');
        mouse.setAttribute('role', 'img');
        mouse.setAttribute('aria-label', 'Left mouse button');
        mouse.appendChild(el('span', 'book-mouse-button'));
        return mouse;
    }
    const cap = el('kbd', 'book-key', key);
    // Arrows and letters are square caps; a named key ('Space') gets a long one.
    if ([...key].length > 1) cap.classList.add('book-key-wide');
    if (ARROWS.has(key)) cap.classList.add('book-key-arrow');
    return cap;
}

function renderControl(hint: ControlHint): HTMLElement {
    const control = el('div', 'book-control');
    const keys = el('div', hint.shape === 'cross' ? 'book-keys book-keys-cross' : 'book-keys');
    keys.append(...hint.keys.map(renderKey));
    control.append(keys, el('span', 'book-control-label', hint.label));
    return control;
}

function renderPage(page: BookPage, kicker: string): HTMLElement[] {
    const parts = [header(kicker, page.title)];

    if (page.image) {
        const figure = el('figure', 'book-figure');
        const image = el('img', 'book-figure-image');
        image.src = page.image.src;
        image.alt = page.image.alt;
        // Decoding off the main thread keeps the page turn smooth on first open.
        image.decoding = 'async';
        figure.appendChild(image);
        parts.push(figure);
    }

    parts.push(el('p', 'book-entry-body', page.body));

    if (page.controls?.length) {
        const controls = el('div', 'book-controls');
        controls.append(...page.controls.map(renderControl));
        parts.push(controls);
    }

    if (page.tips?.length) {
        const tips = el('ul', 'book-tips');
        for (const tip of page.tips) tips.appendChild(el('li', 'book-tip', tip));
        parts.push(tips);
    }
    return parts;
}

/** An entry this module draws; the Level page needs live stats and lives in renderLevelPage. */
export type TextEntry = Exclude<BookEntry, { kind: 'level' }>;

/** Content of the right-hand page. `undefined` = an empty section. */
export function renderBookEntry(entry: TextEntry | undefined): HTMLElement {
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
            page.append(...renderPage(entry.page, entry.sectionId));
            break;
    }
    return page;
}
