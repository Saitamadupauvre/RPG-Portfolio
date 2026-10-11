/**
 * The game's whole colour set. Every lit surface picks from here instead of
 * inventing its own hex, so the world reads as one picture. The reasoning
 * behind each pick lives in docs/art/README.md.
 *
 * Scheme: analogous greens around a warm yellow-green (the bulk of the screen),
 * warm earth tones as the secondary family, and a few small saturated accents
 * from the opposite side of the wheel (berry, gold) for what must pop.
 * Dark tones lean cool (toward blue), light tones lean warm (toward yellow):
 * that hue shift is what keeps shade colourful instead of muddy.
 *
 * Saturation stays moderate on purpose: big areas (meadow, rock, sky) are the
 * most muted, and only the small accents are allowed to be loud.
 */
export const PALETTE = {
    /** Ground and grass. The colour that fills most of the screen. */
    meadow: 0x9dbf58,
    /** Lighter, warmer meadow for the large soft patches on the ground. */
    meadowPatch: 0xa7c263,
    /** Foliage. Darker and cooler than the meadow so trees stand out from it. */
    leaf: 0x52834a,
    /** Foliage in shade, pushed toward blue-green. */
    leafDeep: 0x34574a,
    /** Autumn accent foliage and warm highlights. */
    autumn: 0xd4945a,
    /** Pale warm stone and light wood: statues, sand. */
    wheat: 0xdcc89e,
    /** Cliff faces: a mid brown, warm but muted so it sits under the meadow. */
    rock: 0x8f735c,
    /** Dark wood, cliff shadow, leather. */
    bark: 0x6b4f3f,
    /** Rock and cold stone, nudged toward violet instead of neutral grey. */
    stone: 0x8f8c99,
    /** Deep water. */
    sea: 0x245a73,
    /** Primary accent: flowers, enemies, danger. Near the meadow's complement. */
    berry: 0xc65364,
    /** Secondary accent: treasure, brass, glows. */
    gold: 0xe8c068,
    /** Brightest value, for highlights and metal. */
    cream: 0xfff4dc,
} as const;

/**
 * Light colours, kept apart from the surface colours: these tint everything
 * they touch, so they stay close to white.
 */
export const LIGHT = {
    sky: 0xbcdde8,
    /** Bounce from the ground: the meadow, darkened. Colours every shaded side. */
    bounce: 0x7d8a5e,
    sun: 0xfff1d0,
} as const;
