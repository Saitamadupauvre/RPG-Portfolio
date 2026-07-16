import type { Project } from './Project';

export const projects: Project[] = [
    {
        id: 'rpg-portfolio',
        title: 'RPG Portfolio',
        description: 'This site — a 3D game portfolio built with Three.js and TypeScript.',
        tags: ['three.js', 'typescript', 'vite'],
        links: {},
        rarity: 'legendary',
    },
    {
        id: 'project-two',
        title: 'Project Two',
        description: 'Placeholder description.',
        tags: ['placeholder'],
        links: {},
        rarity: 'rare',
    },
    {
        id: 'project-three',
        title: 'Project Three',
        description: 'Placeholder description.',
        tags: ['placeholder'],
        links: {},
        rarity: 'common',
    },
];
