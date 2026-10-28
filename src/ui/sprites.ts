import { mirror, type Sprite, type SpriteFrame } from './components/pixelSprite';

/*
 * Interface pixel art, drawn by `renderSprite`. One character per pixel, '.'
 * transparent; each sprite's palette says what the other characters are.
 * Colours follow docs/art: warm accents (berry, gold) on dark outlines.
 */

export const HEART: Sprite = {
    palette: { K: '#2b1118', R: '#d8485c', D: '#8f2438', H: '#ffd7dc' },
    frames: [[
        '.KKK...KKK.',
        'KRHRK.KRRRK',
        'KHRRRKRRRDK',
        'KRRRRRRRRDK',
        'KRRRRRRRRDK',
        '.KRRRRRRDK.',
        '..KRRRRDK..',
        '...KRRDK...',
        '....KDK....',
        '.....K.....',
    ]],
};

const COIN_FACE: SpriteFrame = [
    '..KKKKK..',
    '.KWWYYYK.',
    'KWYYOYYOK',
    'KWYYOYYOK',
    'KYYYOYYOK',
    'KYYYOYYOK',
    'KYYYYYYOK',
    '.KYOOOOK.',
    '..KKKKK..',
];

const COIN_TURNED: SpriteFrame = [
    '...KKK...',
    '..KWYYK..',
    '.KWYOYOK.',
    '.KWYOYOK.',
    '.KYYOYOK.',
    '.KYYOYOK.',
    '.KYYYYOK.',
    '..KYOOK..',
    '...KKK...',
];

const COIN_EDGE: SpriteFrame = [
    '....K....',
    '...KYK...',
    '...KWK...',
    '...KYK...',
    '...KYK...',
    '...KYK...',
    '...KOK...',
    '...KOK...',
    '....K....',
];

/** Face, turning, edge, turning back: one spin. Frame 0 is the resting face. */
export const COIN: Sprite = {
    palette: { K: '#3b2410', Y: '#f2c14e', O: '#b8801f', W: '#fff4c8' },
    frames: [COIN_FACE, COIN_TURNED, COIN_EDGE, mirror(COIN_TURNED)],
};

const FIRE_LOGS = [
    '.BBbRRRbBB.',
    'BBBBbbbBBBB',
    '.bb.....bb.',
];

/** Three flickers over the same logs, for the loading screen. */
export const CAMPFIRE: Sprite = {
    palette: { r: '#a8321e', R: '#e8552d', O: '#ffa63d', Y: '#ffe28a', B: '#6b4f3f', b: '#3f2b20' },
    frames: [
        [
            '.....r.....',
            '....rR.....',
            '....RRr....',
            '...rROR....',
            '...ROORr...',
            '..rROYOR...',
            '..ROYYORr..',
            '..ROYYYOR..',
            '...ROYOR...',
            ...FIRE_LOGS,
        ],
        [
            '......r....',
            '.....Rr....',
            '....rRR....',
            '....ROR.r..',
            '...rOORr...',
            '...ROYORr..',
            '..rROYYOR..',
            '..ROYYYOR..',
            '...ROYOR...',
            ...FIRE_LOGS,
        ],
        [
            '....r......',
            '....Rr..r..',
            '...rRR.....',
            '...ROR.....',
            '..rOORr....',
            '..ROYYOR...',
            '..ROYYORr..',
            '..ROYYYOR..',
            '...ROYOR...',
            ...FIRE_LOGS,
        ],
    ],
};

/** A chunky arrow pointing left, for the menu: the recruiter callout points it at its button, `mirror` turns it for the buttons' own arrows. */
const ARROW_LEFT: SpriteFrame = [
    '....K........',
    '...KYK.......',
    '..KYYKKKKKKKK',
    '.KYYYYYYYYYYK',
    'KYWYYYYYYYYYK',
    '.KYYOOOOOOOOK',
    '..KYOKKKKKKKK',
    '...KOK.......',
    '....K........',
];

const ARROW_PALETTE = { K: '#2b1a0e', Y: '#f2c14e', O: '#b8801f', W: '#fff4c8' };

export const ARROW_POINT_LEFT: Sprite = { palette: ARROW_PALETTE, frames: [ARROW_LEFT] };
export const ARROW_POINT_RIGHT: Sprite = { palette: ARROW_PALETTE, frames: [mirror(ARROW_LEFT)] };
