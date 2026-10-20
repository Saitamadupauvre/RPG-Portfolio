import type { BookPage } from './BookPage';

/**
 * Tutorial page ids match `TUTORIAL_IDS` (data/tutorials.ts): a trigger in the
 * world opens the page of the same id.
 */
export const pages: BookPage[] = [
    { id: 'about-me', section: 'about', title: 'About me', body: 'Placeholder body.' },
    { id: 'skills', section: 'about', title: 'Skills', body: 'Placeholder body.' },
    { id: 'contact', section: 'about', title: 'Contact', body: 'Placeholder body.' },
    {
        id: 'movement',
        section: 'tutorial',
        title: 'Movement',
        body: 'Walk anywhere you like: the world is open and the camera follows you. Head toward whatever catches your eye.',
        image: { src: 'tutorial/movement.png', alt: 'The hero walking across the meadow' },
        controls: [
            { keys: ['W', 'A', 'S', 'D'], label: 'QWERTY', shape: 'cross' },
            { keys: ['Z', 'Q', 'S', 'D'], label: 'AZERTY', shape: 'cross' },
            { keys: ['↑', '←', '↓', '→'], label: 'Arrows', shape: 'cross' },
        ],
        tips: [
            'Hold two keys at once to walk diagonally.',
            'Press B at any time to open this book.',
            'Raise Agility at a bonfire to walk faster.',
        ],
    },
    {
        id: 'dash',
        section: 'tutorial',
        title: 'Dash',
        body: 'A quick burst in the direction you are walking. Use it to close in on an enemy, or to get out of the way of a blow.',
        image: { src: 'tutorial/dash.png', alt: 'The hero dashing, a trail streaking behind' },
        controls: [{ keys: ['Space'], label: 'Dash' }],
        tips: [
            'Hold a direction while you press it: standing still, you go nowhere.',
            'Dashing toward a narrow gap leaps across it.',
            'It needs a short breath between two dashes.',
        ],
    },
    {
        id: 'attack',
        section: 'tutorial',
        title: 'Attack',
        body: 'Click where you want to strike: your hero turns toward the cursor and swings. Time your blows, enemies hit back.',
        image: { src: 'tutorial/attack.png', alt: 'The hero slashing, the blade leaving a trail' },
        controls: [{ keys: ['MouseLeft'], label: 'Slash toward the cursor' }],
        tips: [
            'You stand still while you swing: strike, then step away.',
            'Raise Strength at a bonfire to hit harder.',
        ],
    },
];
