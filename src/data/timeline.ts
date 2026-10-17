import type { TimelineEvent } from './TimelineEvent';

// Test data: one event per portfolio project, dated by its first commit.
export const timeline: TimelineEvent[] = [
    {
        id: 'started-glyphwright',
        title: 'Started Glyphwright',
        body: 'Placeholder body.',
        date: { year: 2026, month: 9 },
        projectIds: ['glyphwright'],
    },
    {
        id: 'started-zappy',
        title: 'Started zappy',
        body: 'Placeholder body.',
        date: { year: 2026, month: 6 },
        projectIds: ['zappy'],
    },
    {
        id: 'started-raytracer',
        title: 'Started raytracer',
        body: 'Placeholder body.',
        date: { year: 2026, month: 4 },
        projectIds: ['raytracer'],
    },
    {
        id: 'started-cartridge',
        title: 'Started cartridge',
        body: 'Placeholder body.',
        date: { year: 2026, month: 4 },
        projectIds: ['cartridge'],
    },
    {
        id: 'started-arcade',
        title: 'Started arcade',
        body: 'Placeholder body.',
        date: { year: 2026, month: 3 },
        projectIds: ['arcade'],
    },
    {
        id: 'started-wolf3d',
        title: 'Started wolf3d',
        body: 'Placeholder body.',
        date: { year: 2025, month: 4 },
        projectIds: ['wolf3d'],
    },
    {
        id: 'started-coding',
        title: 'Started coding',
        body: 'Placeholder body.',
        date: { year: 2024, month: 10 },
        projectIds: [],
    },
];
