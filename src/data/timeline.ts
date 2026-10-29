import type { TimelineEvent } from './TimelineEvent';

// Test data: one event per portfolio project, dated by its first commit.
export const timeline: TimelineEvent[] = [
    {
        id: 'started-glyphwright',
        title: { en: 'Started Glyphwright', fr: 'Début de Glyphwright' },
        body: { en: 'Placeholder body.', fr: 'Texte provisoire.' },
        date: { year: 2026, month: 9 },
        projectIds: ['glyphwright'],
    },
    {
        id: 'started-zappy',
        title: { en: 'Started zappy', fr: 'Début de zappy' },
        body: { en: 'Placeholder body.', fr: 'Texte provisoire.' },
        date: { year: 2026, month: 6 },
        projectIds: ['zappy'],
    },
    {
        id: 'started-raytracer',
        title: { en: 'Started raytracer', fr: 'Début du raytracer' },
        body: { en: 'Placeholder body.', fr: 'Texte provisoire.' },
        date: { year: 2026, month: 4 },
        projectIds: ['raytracer'],
    },
    {
        id: 'started-cartridge',
        title: { en: 'Started cartridge', fr: 'Début de cartridge' },
        body: { en: 'Placeholder body.', fr: 'Texte provisoire.' },
        date: { year: 2026, month: 4 },
        projectIds: ['cartridge'],
    },
    {
        id: 'started-arcade',
        title: { en: 'Started arcade', fr: 'Début d’arcade' },
        body: { en: 'Placeholder body.', fr: 'Texte provisoire.' },
        date: { year: 2026, month: 3 },
        projectIds: ['arcade'],
    },
    {
        id: 'started-wolf3d',
        title: { en: 'Started wolf3d', fr: 'Début de wolf3d' },
        body: { en: 'Placeholder body.', fr: 'Texte provisoire.' },
        date: { year: 2025, month: 4 },
        projectIds: ['wolf3d'],
    },
    {
        id: 'started-coding',
        title: { en: 'Started coding', fr: 'Premières lignes de code' },
        body: { en: 'Placeholder body.', fr: 'Texte provisoire.' },
        date: { year: 2024, month: 10 },
        projectIds: [],
    },
];
