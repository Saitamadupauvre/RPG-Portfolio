import type { BookImage, BookPage, ControlHint } from '../../data/BookPage';
import type { SectionId } from '../../domain/book';
import type { Project } from '../../data/Project';
import { findProject } from '../../data/projects';
import type { BookEntry, Lock } from '../../domain/book';
import { projectToUICardStyle } from '../../domain/CardStyle';
import { localize, t } from '../../domain/i18n';
import { bindingFor } from '../../domain/settings';
import { formatDate } from './formatDate';
import { keyName } from './printedKeys';
import { renderKey } from './renderKey';
import { renderLockIcon, sectionLabel } from './renderBookToc';

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
        notice.append(bar, el('span', 'book-progress-label', t('project.progress', { found: lock.found, total: lock.total })));
    }
    return notice;
}

function link(href: string, label: string): HTMLAnchorElement {
    const anchor = el('a', 'book-link', label);
    anchor.href = href;
    // A mail link opens the mail app: a blank tab left behind would be noise.
    if (!href.startsWith('mailto:')) {
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
    }
    return anchor;
}

/** One `<p>` per paragraph: the text separates them with a blank line. */
function paragraphs(text: string): HTMLElement {
    const block = el('div', 'book-entry-text');
    for (const paragraph of text.split(/\n\s*\n/)) {
        block.appendChild(el('p', 'book-entry-body', paragraph.trim()));
    }
    return block;
}

function figure(image: BookImage): HTMLElement {
    const frame = el('figure', image.logo ? 'book-figure book-figure-logo' : 'book-figure');
    const img = el('img', 'book-figure-image');
    img.src = image.src;
    img.alt = localize(image.alt);
    // Decoding off the main thread keeps the page turn smooth on first open.
    img.decoding = 'async';
    frame.appendChild(img);
    return frame;
}

function renderProject(project: Project, lock: Lock): HTMLElement[] {
    if (lock.locked) {
        return [
            header(t('project.kicker'), '???'),
            lockedNotice(t('project.locked'), lock),
        ];
    }

    const style = projectToUICardStyle(project);
    const date = [project.date && formatDate(project.date), project.inProgress && t('project.inProgress')]
        .filter(Boolean)
        .join(' · ');
    const kicker = t('project.kicker.rarity', { rarity: { key: `rarity.${project.rarity}` } });
    const parts: HTMLElement[] = [header(kicker, project.title, date)];
    if (project.image) parts.push(figure(project.image));
    parts.push(paragraphs(localize(project.description)));

    if (project.tags.length > 0) {
        const tags = el('ul', 'book-tags');
        for (const tag of project.tags) tags.appendChild(el('li', 'book-tag', tag));
        parts.push(tags);
    }

    const links = el('div', 'book-links');
    if (project.links.demo) links.appendChild(link(project.links.demo, t('project.demo')));
    if (project.links.repo) links.appendChild(link(project.links.repo, t('project.repo')));
    if (project.links.channel) links.appendChild(link(project.links.channel, t('project.channel')));
    if (links.children.length > 0) parts.push(links);

    parts[0].classList.add(`rarity-${style.frameVariant}`);
    return parts;
}

function renderTimeline(entry: BookEntry & { kind: 'timeline' }): HTMLElement[] {
    const { event, lock } = entry;
    const parts = [header(t('timeline.kicker'), localize(event.title), formatDate(event.date))];

    if (lock.locked) {
        parts.push(lockedNotice(t('timeline.locked'), lock));
        return parts;
    }

    parts.push(el('p', 'book-entry-body', localize(event.body)));
    const related = event.projectIds.map(findProject).filter((p): p is Project => p !== undefined);
    if (related.length > 0) {
        const list = el('ul', 'book-tags');
        for (const project of related) list.appendChild(el('li', 'book-tag', project.title));
        parts.push(list);
    }
    return parts;
}

function renderControl(hint: ControlHint): HTMLElement {
    const control = el('div', 'book-control');
    const keys = el('div', hint.shape === 'cross' ? 'book-keys book-keys-cross' : 'book-keys');
    // A rebound key shows as the player set it, not as the page was written.
    const labels = hint.actions ? hint.actions.map((action) => keyName(bindingFor(action))) : hint.keys;
    keys.append(...labels.map(renderKey));
    control.append(keys, el('span', 'book-control-label', localize(hint.label)));
    return control;
}

function renderPage(page: BookPage, sectionId: SectionId): HTMLElement[] {
    const parts = [header(sectionLabel(sectionId), localize(page.title))];

    if (page.image) parts.push(figure(page.image));

    parts.push(paragraphs(localize(page.body)));

    if (page.controls?.length) {
        const controls = el('div', 'book-controls');
        controls.append(...page.controls.map(renderControl));
        parts.push(controls);
    }

    if (page.tips?.length) {
        const tips = el('ul', 'book-tips');
        for (const tip of page.tips) tips.appendChild(el('li', 'book-tip', localize(tip)));
        parts.push(tips);
    }

    if (page.links?.length) {
        const links = el('div', 'book-links');
        links.append(...page.links.map(({ href, label }) => link(href, localize(label))));
        parts.push(links);
    }
    return parts;
}

/**
 * An entry this module draws. The Level and Settings spreads draw live state
 * and live in renderLevelPage / renderSettingsPage.
 */
export type TextEntry = Exclude<BookEntry, { kind: 'level' | 'settings' }>;

/** Content of the right-hand page. `undefined` = an empty section. */
export function renderBookEntry(entry: TextEntry | undefined): HTMLElement {
    const page = el('article', 'book-entry');

    if (!entry) {
        page.appendChild(el('p', 'book-empty', t('book.blank')));
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
