import type { BookPage } from '../data/BookPage';
import type { Project } from '../data/Project';
import type { TimelineEvent } from '../data/TimelineEvent';
import { pages } from '../data/pages';
import { findProject, projects } from '../data/projects';
import { timeline } from '../data/timeline';
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
    | { id: PageSectionId; label: string; pages: BookPage[] };

export type SectionId = BookSection['id'];

type SectionDefinition = { id: SectionId; label: string; gameOnly: boolean };

export const SECTIONS: readonly SectionDefinition[] = [
    { id: 'projects', label: 'Projects', gameOnly: false },
    { id: 'timeline', label: 'Timeline', gameOnly: false },
    { id: 'about', label: 'About', gameOnly: false },
    { id: 'tutorial', label: 'Tutorial', gameOnly: true },
    { id: 'bestiary', label: 'Bestiary', gameOnly: true },
];

export function validateBook() {
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
    bestiary: pageSection('bestiary'),
};

export function getBook(mode: BookMode): BookSection[] {
    const found: FoundCheck = mode === 'classic' ? () => true : isDiscovered;

    return SECTIONS.filter((section) => mode === 'game' || !section.gameOnly).map((section) =>
        builders[section.id](section.label, found),
    );
}
