import type { BookPage } from '../data/BookPage';
import type { Project } from '../data/Project';
import type { TimelineEvent } from '../data/TimelineEvent';
import { pages } from '../data/pages';
import { findProject, projects } from '../data/projects';
import { timeline } from '../data/timeline';
import { TUTORIAL_IDS } from '../data/tutorials';
import { isDiscovered } from './discovery';

export type BookMode = 'game' | 'classic';

export type Lock = { locked: false } | { locked: true; found: number; total: number };

type FoundCheck = (projectId: string) => boolean;

export type ProjectEntry = { project: Project; lock: Lock };
export type TimelineEntry = { event: TimelineEvent; lock: Lock };
export type TimelineMonth = { month: number; events: TimelineEntry[] };
export type TimelineYear = { year: number; months: TimelineMonth[] };

type PageSectionId = BookPage['section'];

export type BookSection =
    | { id: 'projects'; label: string; entries: ProjectEntry[] }
    | { id: 'timeline'; label: string; years: TimelineYear[] }
    | { id: PageSectionId; label: string; pages: BookPage[] }
    /** The player and their stats: one spread, drawn from `playerProgress` at render time. */
    | { id: 'level'; label: string }
    /** Controls on the left, everything else on the right: one spread, drawn from `settings` at render time. */
    | { id: 'settings'; label: string };

export type SectionId = BookSection['id'];

type SectionDefinition = { id: SectionId; label: string; gameOnly: boolean };

export const SECTIONS: readonly SectionDefinition[] = [
    { id: 'projects', label: 'Projects', gameOnly: false },
    { id: 'timeline', label: 'Timeline', gameOnly: false },
    { id: 'about', label: 'About', gameOnly: false },
    { id: 'tutorial', label: 'Tutorial', gameOnly: true },
    { id: 'level', label: 'Level', gameOnly: true },
    { id: 'settings', label: 'Settings', gameOnly: true },
];

export function validateBook() {
    // A trigger opens the tutorial page of the same id; a missing page would open the book on nothing.
    for (const tutorialId of TUTORIAL_IDS) {
        if (!pages.some((page) => page.section === 'tutorial' && page.id === tutorialId)) {
            throw new Error(`Tutorial "${tutorialId}" has no page in data/pages.ts`);
        }
    }
    for (const event of timeline) {
        for (const projectId of event.projectIds) {
            if (!findProject(projectId)) {
                throw new Error(`Timeline event "${event.id}" references unknown project "${projectId}"`);
            }
        }
    }
}

function lockFor(projectIds: string[], found: FoundCheck): Lock {
    const total = projectIds.length;
    const foundCount = projectIds.filter(found).length;
    return foundCount === total ? { locked: false } : { locked: true, found: foundCount, total };
}

function groupTimeline(entries: TimelineEntry[]): TimelineYear[] {
    const sorted = [...entries].sort(
        (a, b) => b.event.date.year - a.event.date.year || b.event.date.month - a.event.date.month,
    );

    const years: TimelineYear[] = [];
    for (const entry of sorted) {
        const { year, month } = entry.event.date;

        let yearGroup = years[years.length - 1];
        if (yearGroup?.year !== year) {
            yearGroup = { year, months: [] };
            years.push(yearGroup);
        }

        let monthGroup = yearGroup.months[yearGroup.months.length - 1];
        if (monthGroup?.month !== month) {
            monthGroup = { month, events: [] };
            yearGroup.months.push(monthGroup);
        }

        monthGroup.events.push(entry);
    }
    return years;
}

type SectionBuilders = {
    [K in SectionId]: (label: string, found: FoundCheck) => BookSection & { id: K };
};

const pageSection =
    <K extends PageSectionId>(id: K) =>
    (label: string) => ({ id, label, pages: pages.filter((page) => page.section === id) });

const builders: SectionBuilders = {
    projects: (label, found) => ({
        id: 'projects',
        label,
        entries: projects.map((project) => ({ project, lock: lockFor([project.id], found) })),
    }),
    timeline: (label, found) => ({
        id: 'timeline',
        label,
        years: groupTimeline(timeline.map((event) => ({ event, lock: lockFor(event.projectIds, found) }))),
    }),
    about: pageSection('about'),
    tutorial: pageSection('tutorial'),
    level: (label) => ({ id: 'level', label }),
    settings: (label) => ({ id: 'settings', label }),
};

export function getBook(mode: BookMode): BookSection[] {
    const found: FoundCheck = mode === 'classic' ? () => true : isDiscovered;

    return SECTIONS.filter((section) => mode === 'game' || !section.gameOnly).map((section) =>
        builders[section.id](section.label, found),
    );
}

/** One readable page of the book, in reading order. `key` is unique across kinds. */
export type BookEntry =
    | { kind: 'project'; key: string; sectionId: 'projects'; project: Project; lock: Lock }
    | { kind: 'timeline'; key: string; sectionId: 'timeline'; event: TimelineEvent; lock: Lock }
    | { kind: 'page'; key: string; sectionId: PageSectionId; page: BookPage }
    | { kind: 'level'; key: string; sectionId: 'level' }
    | { kind: 'settings'; key: string; sectionId: 'settings' };

export const entryKey = (kind: BookEntry['kind'], id: string) => `${kind}:${id}`;

/** The Level section's only entry. */
export const LEVEL_KEY = entryKey('level', 'player');

/** The Settings section's only entry. */
export const SETTINGS_KEY = entryKey('settings', 'main');

/** Sections drawn as one spread, whose left page is not a table of contents. */
export function isSpreadSection(id: SectionId): id is 'level' | 'settings' {
    return id === 'level' || id === 'settings';
}

/** Every entry of every section, in the order the pages sit in the book. */
export function flattenBook(sections: BookSection[]): BookEntry[] {
    return sections.flatMap((section): BookEntry[] => {
        if (section.id === 'projects') {
            return section.entries.map(({ project, lock }) => ({
                kind: 'project',
                key: entryKey('project', project.id),
                sectionId: 'projects',
                project,
                lock,
            }));
        }
        if (section.id === 'timeline') {
            return section.years.flatMap((year) =>
                year.months.flatMap((month) =>
                    month.events.map(({ event, lock }) => ({
                        kind: 'timeline' as const,
                        key: entryKey('timeline', event.id),
                        sectionId: 'timeline' as const,
                        event,
                        lock,
                    })),
                ),
            );
        }
        if (section.id === 'level') {
            return [{ kind: 'level', key: LEVEL_KEY, sectionId: 'level' }];
        }
        if (section.id === 'settings') {
            return [{ kind: 'settings', key: SETTINGS_KEY, sectionId: 'settings' }];
        }
        return section.pages.map((page) => ({
            kind: 'page',
            key: entryKey('page', page.id),
            sectionId: section.id,
            page,
        }));
    });
}
