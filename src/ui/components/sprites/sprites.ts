import { mirror, type Sprite, type SpriteFrame } from './pixelSprite';

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

const PHONE_UPRIGHT: SpriteFrame = [
    '.............',
    '...KKKKKKK...',
    '...KSSSSSK...',
    '...KSSSSSK...',
    '...KSSSSSK...',
    '...KSSSSSK...',
    '...KSSSSSK...',
    '...KSSSSSK...',
    '...KSSSSSK...',
    '...KSSSSSK...',
    '...KKK.KKK...',
    '...KKKKKKK...',
    '.............',
];

/** The same phone a quarter turn anticlockwise: the button ends up on the right. */
const PHONE_SIDEWAYS: SpriteFrame = [
    '.............',
    '.............',
    '.............',
    '.KKKKKKKKKKK.',
    '.KSSSSSSSSKK.',
    '.KSSSSSSSSKK.',
    '.KSSSSSSSS.K.',
    '.KSSSSSSSSKK.',
    '.KSSSSSSSSKK.',
    '.KKKKKKKKKKK.',
    '.............',
    '.............',
    '.............',
];

/** Upright, then sideways, for the rotate screen. */
export const PHONE_TURN: Sprite = {
    palette: { K: '#fff4dc', S: '#f2c14e' },
    frames: [PHONE_UPRIGHT, PHONE_SIDEWAYS],
};

/** Touch attack stick: a sword, blade up to the right. */
export const SWORD: Sprite = {
    palette: { K: '#1b0e14', W: '#fff4dc', S: '#b0aabe', G: '#f2c14e', D: '#a86a1e', H: '#b27a45', h: '#7a3519' },
    frames: [[
        '..............K.',
        '.............KWK',
        '............KWSK',
        '...........KWSK.',
        '..........KWSK..',
        '.........KWSK...',
        '........KWSK....',
        '...KK..KWSK.....',
        '..KDGKKWSK......',
        '...KDGWSK.......',
        '....KDGK........',
        '...KHhDGK.......',
        '.KKHhKKDK.......',
        'KGGhK..K........',
        'KDGK............',
        '.KK.............',
    ]],
};

/** Touch dash button: two chevrons rushing right. */
export const DASH: Sprite = {
    palette: { S: '#f2c14e', B: '#fff4dc' },
    frames: [[
        'SS....BB....',
        '.SS....BB...',
        '..SS....BB..',
        '...SS....BB.',
        '....SS....BB',
        '...SS....BB.',
        '..SS....BB..',
        '.SS....BB...',
        'SS....BB....',
    ]],
};

/** Touch book button: the closed book, gold plate on the cover, page edges on the right. */
export const BOOK: Sprite = {
    palette: { C: '#b4582e', D: '#7a3519', G: '#f2c14e', P: '#fff4dc' },
    frames: [[
        '.CCCCCCCCC..',
        '.CCCCCCCCCP.',
        '.CCGGGGGCCP.',
        '.CCGCCCGCCP.',
        '.CCGGGGGCCP.',
        '.CCCCCCCCCP.',
        '.CCCCCCCCCP.',
        '.CCCCCCCCCP.',
        '.DDDDDDDDDP.',
        '..PPPPPPPPP.',
    ]],
};
