import { entryKey, type BookSection, type Lock, type SectionId } from '../../domain/book';
import { monthName } from './formatDate';

export type TocContext = {
    /** Index of an entry in the flat reading order, from its `entryKey`. */
    indexOf: (key: string) => number;
    current: number;
    /** Keys of the timeline year/month groups the reader expanded. Mutated on toggle. */
    openGroups: Set<string>;
    onSelect: (index: number) => void;
};

const LOCKED_TITLE = '???';

export function renderLockIcon(): HTMLElement {
    const icon = document.createElement('span');
    icon.className = 'book-lock';
    icon.setAttribute('aria-label', 'Locked');
    return icon;
}

export function renderBookTabs(
    sections: BookSection[],
    activeId: SectionId,
    onSelect: (id: SectionId) => void,
): HTMLElement[] {
    return sections.map((section) => {
        const tab = document.createElement('button');
        tab.className = `book-tab book-tab-${section.id}`;
        tab.classList.toggle('active', section.id === activeId);
        tab.textContent = section.label;
        tab.addEventListener('click', () => onSelect(section.id));
        return tab;
    });
}

function renderItem(key: string, title: string, lock: Lock, context: TocContext): HTMLElement {
    const index = context.indexOf(key);

    const item = document.createElement('button');
    item.className = 'book-toc-item';
    item.classList.toggle('active', index === context.current);
    item.classList.toggle('locked', lock.locked);
    item.addEventListener('click', () => context.onSelect(index));

    const label = document.createElement('span');
    label.className = 'book-toc-label';
    label.textContent = title;
    item.appendChild(label);

    if (lock.locked) {
        item.appendChild(renderLockIcon());
        if (lock.total > 1) {
            const progress = document.createElement('span');
            progress.className = 'book-toc-progress';
            progress.textContent = `${lock.found}/${lock.total}`;
            item.appendChild(progress);
        }
    }
    return item;
}

/**
 * A collapsible group. Native `<details>` keeps its own open state, but the TOC
 * is rebuilt on every page change, so the state is mirrored into `openGroups`.
 */
function renderGroup(groupKey: string, label: string, containsCurrent: boolean, context: TocContext) {
    const group = document.createElement('details');
    group.className = 'book-toc-group';
    group.open = containsCurrent || context.openGroups.has(groupKey);
    group.addEventListener('toggle', () => {
        if (group.open) context.openGroups.add(groupKey);
        else context.openGroups.delete(groupKey);
    });

    const summary = document.createElement('summary');
    summary.textContent = label;
    group.appendChild(summary);
    return group;
}

export function renderBookToc(section: BookSection, context: TocContext): HTMLElement {
    const toc = document.createElement('div');
    toc.className = 'book-toc';

    const heading = document.createElement('h2');
    heading.className = 'book-page-title';
    heading.textContent = section.label;
    toc.appendChild(heading);

    const list = document.createElement('div');
    list.className = 'book-toc-list';
    toc.appendChild(list);

    if (section.id === 'projects') {
        for (const { project, lock } of section.entries) {
            const title = lock.locked ? LOCKED_TITLE : project.title;
            list.appendChild(renderItem(entryKey('project', project.id), title, lock, context));
        }
    } else if (section.id === 'timeline') {
        for (const year of section.years) {
            const keysInYear = year.months.flatMap((m) => m.events.map((e) => entryKey('timeline', e.event.id)));
            const yearHasCurrent = keysInYear.some((key) => context.indexOf(key) === context.current);
            const yearGroup = renderGroup(`y${year.year}`, String(year.year), yearHasCurrent, context);

            for (const month of year.months) {
                const keys = month.events.map((e) => entryKey('timeline', e.event.id));
                const monthHasCurrent = keys.some((key) => context.indexOf(key) === context.current);
                const monthGroup = renderGroup(
                    `y${year.year}m${month.month}`,
                    monthName(month.month),
                    monthHasCurrent,
                    context,
                );
                month.events.forEach(({ event, lock }, i) => {
                    monthGroup.appendChild(renderItem(keys[i], event.title, lock, context));
                });
                yearGroup.appendChild(monthGroup);
            }
            list.appendChild(yearGroup);
        }
    } else {
        for (const page of section.pages) {
            list.appendChild(renderItem(entryKey('page', page.id), page.title, { locked: false }, context));
        }
    }

    if (list.children.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'book-empty';
        empty.textContent = 'Nothing written here yet.';
        list.appendChild(empty);
    }
    return toc;
}
