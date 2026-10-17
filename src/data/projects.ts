import type { Project } from './Project';

export const projects: Project[] = [
    {
        id: 'glyphwright',
        title: 'Glyphwright',
        description:
            'Solo 2D game engine in C++. ECS with SoA component storage, one-line reflection macro, and hot-swappable renderer dylibs: the same game code runs as ASCII, terminal graphics or a native window. Ships with a terminal editor (FTXUI) for inspecting and saving scenes.',
        tags: ['c++', 'cmake', 'ecs', 'game engine'],
        links: { repo: 'https://github.com/Saitamadupauvre/Glyphwright' },
        rarity: 'epic',
        date: { year: 2026, month: 9 },
    },
    {
        id: 'zappy',
        title: 'Zappy',
        description:
            'Networked game where autonomous AI agents compete to raise their civilization to level 8. Three programs talk over TCP: a C server, a C++/Raylib 3D spectator client and Python AI agents (including a reinforcement-learning strategy). I worked on the server and its protocol.',
        tags: ['c', 'c++', 'python', 'networking', 'raylib'],
        links: { repo: 'https://github.com/Saitamadupauvre/zappy' },
        rarity: 'legendary',
        date: { year: 2026, month: 6 },
    },
    {
        id: 'raytracer',
        title: 'Raytracer',
        description:
            'Plugin-based raytracer in C++20: shapes, lights and materials are loaded at runtime, and scenes are described in config files. I worked on the rendering architecture (entities, factories, scene management).',
        tags: ['c++', 'cmake', 'graphics', 'ci'],
        links: { repo: 'https://github.com/Saitamadupauvre/raytracer' },
        rarity: 'legendary',
        date: { year: 2026, month: 4 },
    },
    {
        id: 'cartridge',
        title: 'Cartridge',
        description:
            'GameBoy game written in C, with three mini games: a Touhou-style bullet hell, Flappy Bird and a tiny Balatro. Built within the hardware limits (no floating point, very little memory) on an entity-system loop.',
        tags: ['c', 'gameboy', 'embedded', 'gbdk'],
        links: { repo: 'https://github.com/Saitamadupauvre/cartridge' },
        rarity: 'epic',
        date: { year: 2026, month: 4 },
    },
    {
        id: 'arcade',
        title: 'Arcade',
        description:
            'Retro gaming platform in C++ where graphics and game libraries are swapped at runtime. I built the core that loads them (dlopen) and the shared module interfaces.',
        tags: ['c++', 'cmake', 'plugins'],
        links: { repo: 'https://github.com/Saitamadupauvre/arcade' },
        rarity: 'epic',
        date: { year: 2026, month: 3 },
    },
    {
        id: 'wolf3d',
        title: 'Wolf3D',
        description:
            'Wolfenstein 3D-style first-person shooter in C on a raycasting engine: textured walls, animated weapons and enemies, sound, menus and save/load.',
        tags: ['c', 'raycasting', 'graphics'],
        links: { repo: 'https://github.com/Saitamadupauvre/wolf3d' },
        rarity: 'rare',
        date: { year: 2025, month: 4 },
    },
];

export function findProject(projectId: string): Project | undefined {
    return projects.find((project) => project.id === projectId);
}
