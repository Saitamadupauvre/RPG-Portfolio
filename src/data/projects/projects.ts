import type { Project } from './Project';

/** One paragraph per string, separated by a blank line as `Project.description` expects. */
const text = (...paragraphs: string[]) => paragraphs.join('\n\n');

export const projects: Project[] = [
    {
        id: 'glyphwright',
        title: 'Glyphwright',
        description: {
            en: text(
                'A 2D game engine I am building on my own in C++.',
                'Components are stored in cache-friendly arrays, and a one-line macro makes any type editable.',
                'Renderers are swapped while the game runs: the same game shows as ASCII art, terminal graphics or a native window. A terminal editor lets me inspect and save scenes.',
            ),
            fr: text(
                'Un moteur de jeu 2D que je développe seul en C++.',
                'Les composants sont rangés dans des tableaux pensés pour le cache, et une macro d’une ligne rend n’importe quel type éditable.',
                'Les moteurs de rendu se changent en plein jeu : le même jeu s’affiche en art ASCII, en graphismes de terminal ou dans une fenêtre native. Un éditeur en terminal me permet d’inspecter et d’enregistrer les scènes.',
            ),
        },
        tags: ['c++', 'cmake', 'ecs', 'game engine'],
        links: { repo: 'https://github.com/Saitamadupauvre/Glyphwright' },
        rarity: 'epic',
        date: { year: 2026, month: 9 },
        inProgress: true,
    },
    {
        id: 'zappy',
        title: 'Zappy',
        description: {
            en: text(
                'A networked game where AI players compete to lead their team to the top level.',
                'Three programs talk over TCP: a C server, a 3D viewer in C++ with Raylib, and AI clients in Python, one of them trained with reinforcement learning.',
                'My part: the server and its protocol.',
            ),
            fr: text(
                'Un jeu en réseau où des joueurs IA s’affrontent pour mener leur équipe au niveau maximal.',
                'Trois programmes dialoguent en TCP : un serveur en C, un visualiseur 3D en C++ avec Raylib, et des clients IA en Python, dont un entraîné par apprentissage par renforcement.',
                'Ma part : le serveur et son protocole.',
            ),
        },
        tags: ['c', 'c++', 'python', 'networking', 'raylib'],
        links: { repo: 'https://github.com/Saitamadupauvre/zappy' },
        rarity: 'legendary',
        date: { year: 2026, month: 6 },
    },
    {
        id: 'raytracer',
        title: 'Raytracer',
        description: {
            en: text(
                'A raytracer in C++20 that renders scenes described in config files, with reflection, refraction and textures.',
                'Shapes, lights and materials are plugins loaded at runtime, so adding one needs no rebuild.',
                'My part: the rendering architecture, with its entities, factories and scene management.',
            ),
            fr: text(
                'Un raytracer en C++20 qui rend des scènes décrites dans des fichiers de configuration, avec réflexion, réfraction et textures.',
                'Formes, lumières et matériaux sont des plugins chargés à l’exécution : en ajouter un ne demande aucune recompilation.',
                'Ma part : l’architecture du rendu, avec ses entités, ses factories et la gestion des scènes.',
            ),
        },
        tags: ['c++', 'cmake', 'graphics', 'ci'],
        links: { repo: 'https://github.com/Saitamadupauvre/raytracer' },
        rarity: 'legendary',
        date: { year: 2026, month: 4 },
    },
    {
        id: 'cartridge',
        title: 'Cartridge',
        description: {
            en: text(
                'A GameBoy cartridge in C holding three mini games: a bullet hell, a Flappy Bird and a tiny Balatro.',
                'Everything fits the real hardware: no floating point, a few kilobytes of memory and a fixed frame budget.',
            ),
            fr: text(
                'Une cartouche GameBoy en C qui contient trois mini-jeux : un bullet hell, un Flappy Bird et un petit Balatro.',
                'Tout tient sur le vrai matériel : pas de virgule flottante, quelques kilo-octets de mémoire et un budget fixe par image.',
            ),
        },
        tags: ['c', 'gameboy', 'embedded', 'gbdk'],
        links: { repo: 'https://github.com/Saitamadupauvre/cartridge' },
        rarity: 'epic',
        date: { year: 2026, month: 4 },
    },
    {
        id: 'arcade',
        title: 'Arcade',
        description: {
            en: text(
                'A retro arcade platform in C++. Both the games and the graphics libraries are swapped while it runs.',
                'My part: the core that loads them as shared libraries, and the interfaces every module follows.',
            ),
            fr: text(
                'Une borne d’arcade rétro en C++. Les jeux comme les bibliothèques graphiques se changent pendant l’exécution.',
                'Ma part : le cœur qui les charge en bibliothèques partagées, et les interfaces que suit chaque module.',
            ),
        },
        tags: ['c++', 'cmake', 'plugins'],
        links: { repo: 'https://github.com/Saitamadupauvre/arcade' },
        rarity: 'epic',
        date: { year: 2026, month: 3 },
    },
    {
        id: 'wolf3d',
        title: 'Wolf3D',
        description: {
            en: text(
                'A first-person shooter in C in the style of Wolfenstein 3D, on a raycasting engine written from scratch.',
                'Textured walls, animated weapons and enemies, sound, menus and save files.',
            ),
            fr: text(
                'Un jeu de tir à la première personne en C dans l’esprit de Wolfenstein 3D, sur un moteur de raycasting écrit de zéro.',
                'Murs texturés, armes et ennemis animés, son, menus et sauvegardes.',
            ),
        },
        tags: ['c', 'raycasting', 'graphics'],
        links: { repo: 'https://github.com/Saitamadupauvre/wolf3d' },
        rarity: 'rare',
        date: { year: 2025, month: 4 },
    },
    {
        id: 'youtube',
        title: 'Gamaster',
        description: {
            en: text(
                'My YouTube channel, in French: game devlogs and challenges where I build a game in a few days.',
                'From a Space Invaders in 3 days to Dark Souls remade in 2D, I make PC and mobile games, edit the videos, and share what went wrong along the way.',
                '830 subscribers and 37.8K views.',
            ),
            fr: text(
                'Ma chaîne YouTube : des devlogs et des défis où je crée un jeu en quelques jours.',
                'D’un Space Invaders en 3 jours à Dark Souls refait en 2D, je crée des jeux PC et mobile, monte les vidéos et partage ce qui a coincé en chemin.',
                '830 abonnés et 37 800 vues.',
            ),
        },
        tags: ['youtube', 'devlog', 'video editing'],
        links: { channel: 'https://www.youtube.com/@GameMasterDevFr/videos' },
        rarity: 'rare',
        date: { year: 2024, month: 3 },
        image: {
            src: 'projects/youtube-logo.jpg',
            alt: { en: 'Logo of the Gamaster channel', fr: 'Logo de la chaîne Gamaster' },
            logo: true,
        },
    },
];

export function findProject(projectId: string): Project | undefined {
    return projects.find((project) => project.id === projectId);
}
