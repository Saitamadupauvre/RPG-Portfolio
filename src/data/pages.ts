import type { BookPage } from './BookPage';

/** One paragraph per string, separated by a blank line as `BookPage.body` expects. */
const text = (...paragraphs: string[]) => paragraphs.join('\n\n');

/**
 * Tutorial page ids match `TUTORIAL_IDS` (data/tutorials.ts): a trigger in the
 * world opens the page of the same id.
 */
export const pages: BookPage[] = [
    {
        id: 'about-me',
        section: 'about',
        title: { en: 'About me', fr: 'Qui suis-je' },
        body: {
            en: text(
                "I'm Alban Lembrez, a third-year student at Epitech Montpellier, working toward the Expert in Information Technology degree (2024-2029).",
                "I've been designing video games since middle school, and I want to make it my job as a gameplay programmer.",
                'From July to December 2025, I was a software development intern at Alterego Concept SA in Geneva. I built a Python app to collect field data (forms, storage, export) and automated report generation to cut down on manual work.',
                "Outside class, I've run Epitech's coding club since February 2025, with Python, Lua and JavaScript sessions for about twenty people. I took part in the Global Game Jam 2025 in a team of four, and I post game devlogs on YouTube.",
            ),
            fr: text(
                'Je suis Alban Lembrez, étudiant en troisième année à Epitech Montpellier, en cursus Expert en Technologies de l’Information (2024-2029).',
                'Je conçois des jeux vidéo depuis le collège, et je veux en faire mon métier en tant que programmeur gameplay.',
                'De juillet à décembre 2025, j’ai été stagiaire en développement logiciel chez Alterego Concept SA à Genève. J’y ai développé une application Python de collecte de données terrain (formulaires, stockage, export) et automatisé la génération de rapports pour réduire le travail manuel.',
                'En dehors des cours, j’anime depuis février 2025 le club de code d’Epitech, avec des sessions Python, Lua et JavaScript pour une vingtaine de personnes. J’ai participé à la Global Game Jam 2025 dans une équipe de quatre, et je publie des devlogs de jeux sur YouTube.',
            ),
        },
        links: [{ href: 'cv/Alban_LEMBREZ_CV.pdf', label: { en: 'My CV (PDF, French)', fr: 'Mon CV (PDF)' } }],
    },
    {
        id: 'skills',
        section: 'about',
        title: { en: 'Skills', fr: 'Compétences' },
        body: {
            en: 'Most of my work is in C and C++, close to the machine: game engines, networking, rendering and embedded code. I use Python for tools, AI and automation.',
            fr: 'L’essentiel de mon travail est en C et C++, au plus près de la machine : moteurs de jeu, réseau, rendu et code embarqué. J’utilise Python pour les outils, l’IA et l’automatisation.',
        },
        tips: [
            { en: 'Languages: C, C++, Python, TypeScript', fr: 'Langages : C, C++, Python, TypeScript' },
            { en: 'Engines: Unity, Unreal Engine', fr: 'Moteurs : Unity, Unreal Engine' },
            {
                en: 'Topics: game engines, networking, rendering, plugins',
                fr: 'Domaines : moteurs de jeu, réseau, rendu, plugins',
            },
            {
                en: 'Spoken: French, English (B2), Spanish (A2)',
                fr: 'Langues : français, anglais (B2), espagnol (A2)',
            },
            {
                en: 'Also: drawing, 3D modelling, video editing',
                fr: 'Aussi : dessin, modélisation 3D, montage vidéo',
            },
        ],
    },
    {
        id: 'contact',
        section: 'about',
        title: { en: 'Contact', fr: 'Contact' },
        body: {
            en: 'Looking for a gameplay programmer or want to talk about a project? Reach out by email or on LinkedIn.',
            fr: 'Vous cherchez un programmeur gameplay ou voulez parler d’un projet ? Écrivez-moi par e-mail ou sur LinkedIn.',
        },
        links: [
            { href: 'mailto:lembrez.alban@gmail.com', label: { en: 'Email', fr: 'E-mail' } },
            { href: 'https://www.linkedin.com/in/alban-lembrez/', label: { en: 'LinkedIn', fr: 'LinkedIn' } },
            { href: 'https://github.com/Saitamadupauvre', label: { en: 'GitHub', fr: 'GitHub' } },
            { href: 'https://www.youtube.com/@GameMasterDevFr', label: { en: 'YouTube', fr: 'YouTube' } },
        ],
    },
    {
        id: 'movement',
        section: 'tutorial',
        title: { en: 'Movement', fr: 'Déplacement' },
        body: {
            en: 'Walk anywhere you like: the world is open and the camera follows you. Head toward whatever catches your eye.',
            fr: 'Allez où bon vous semble : le monde est ouvert et la caméra vous suit. Dirigez-vous vers ce qui attire votre regard.',
        },
        image: {
            src: 'tutorial/movement.png',
            alt: { en: 'The hero walking across the meadow', fr: 'Le héros traversant la prairie' },
        },
        controls: [
            {
                keys: ['W', 'A', 'S', 'D'],
                label: { en: 'Your keys', fr: 'Vos touches' },
                shape: 'cross',
                actions: ['up', 'left', 'down', 'right'],
            },
            { keys: ['↑', '←', '↓', '→'], label: { en: 'Arrows', fr: 'Flèches' }, shape: 'cross' },
        ],
        tips: [
            {
                en: 'Hold two keys at once to walk diagonally.',
                fr: 'Maintenez deux touches à la fois pour marcher en diagonale.',
            },
            {
                en: 'Press B at any time to open this book, Escape for the settings.',
                fr: 'Appuyez sur B à tout moment pour ouvrir ce livre, sur Échap pour les réglages.',
            },
            {
                en: 'Raise Agility at a bonfire to walk faster.',
                fr: 'Augmentez l’Agilité au feu de camp pour marcher plus vite.',
            },
        ],
    },
    {
        id: 'dash',
        section: 'tutorial',
        title: { en: 'Dash', fr: 'Esquive' },
        body: {
            en: 'A quick burst in the direction you are walking. Use it to close in on an enemy, or to get out of the way of a blow.',
            fr: 'Un bond rapide dans la direction où vous marchez. Servez-vous-en pour fondre sur un ennemi, ou pour éviter un coup.',
        },
        image: {
            src: 'tutorial/dash.png',
            alt: { en: 'The hero dashing, a trail streaking behind', fr: 'Le héros en pleine esquive, une traînée derrière lui' },
        },
        controls: [{ keys: ['Space'], label: { en: 'Dash', fr: 'Esquive' }, actions: ['dash'] }],
        tips: [
            {
                en: 'Hold a direction while you press it: standing still, you go nowhere.',
                fr: 'Tenez une direction en appuyant : à l’arrêt, vous n’allez nulle part.',
            },
            {
                en: 'Dashing toward a narrow gap leaps across it.',
                fr: 'Une esquive vers un fossé étroit le franchit d’un bond.',
            },
            {
                en: 'It needs a short breath between two dashes.',
                fr: 'Il faut reprendre son souffle entre deux esquives.',
            },
        ],
    },
    {
        id: 'attack',
        section: 'tutorial',
        title: { en: 'Attack', fr: 'Attaque' },
        body: {
            en: 'Click where you want to strike: your hero turns toward the cursor and swings. Time your blows, enemies hit back.',
            fr: 'Cliquez là où vous voulez frapper : votre héros se tourne vers le curseur et frappe. Choisissez bien le moment, les ennemis ripostent.',
        },
        image: {
            src: 'tutorial/attack.png',
            alt: { en: 'The hero slashing, the blade leaving a trail', fr: 'Le héros frappant, la lame laissant une traînée' },
        },
        controls: [{ keys: ['MouseLeft'], label: { en: 'Slash toward the cursor', fr: 'Frapper vers le curseur' } }],
        tips: [
            {
                en: 'You stand still while you swing: strike, then step away.',
                fr: 'Vous restez immobile pendant le coup : frappez, puis reculez.',
            },
            {
                en: 'Raise Strength at a bonfire to hit harder.',
                fr: 'Augmentez la Force au feu de camp pour frapper plus fort.',
            },
        ],
    },
    {
        id: 'statue',
        section: 'tutorial',
        title: { en: 'Statues', fr: 'Statues' },
        body: {
            en: 'Each statue keeps one of my projects. A glowing statue has not been found yet: walk up to it and press the key to read its project in this book.',
            fr: 'Chaque statue garde un de mes projets. Une statue lumineuse n’a pas encore été trouvée : approchez-vous et appuyez sur la touche pour lire son projet dans ce livre.',
        },
        controls: [{ keys: ['E'], label: { en: 'Read the statue', fr: 'Lire la statue' }, actions: ['interact'] }],
        tips: [
            {
                en: 'Once found, the statue stops glowing but stays where it stands.',
                fr: 'Une fois trouvée, la statue cesse de briller mais reste à sa place.',
            },
            {
                en: 'Every project you find waits in this book: press B to read it again.',
                fr: 'Chaque projet trouvé vous attend dans ce livre : appuyez sur B pour le relire.',
            },
        ],
    },
];
