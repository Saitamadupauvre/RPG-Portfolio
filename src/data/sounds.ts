/**
 * Every sound the game can play, one entry per id. Pure content: the files and
 * how each one should vary; `audio/audio.ts` does the playing.
 *
 * To add a sound: drop the file(s) under `public/audio/<bus>/`, add an entry
 * here, then call `playSound('<id>')` where it happens. The id type is derived
 * from this table, so a typo in a `playSound` call fails the type-check.
 */

/** Separate volume knobs, one gain each. Which slider drives which is decided in `main.ts`. */
export const AUDIO_BUSES = ['sfx', 'music', 'ui', 'ambience'] as const;

export type AudioBus = (typeof AUDIO_BUSES)[number];

export type SoundDefinition = {
    /** Paths under `public/`. Several = variants, one picked at random per play (never the same twice in a row). */
    files: readonly string[];
    bus: AudioBus;
    /** 0..1, before the bus and master volumes. */
    volume: number;
    /**
     * Playback rate range, picked at random per play: [0.9, 1.1] = up to 10% lower or higher.
     * Rate shifts pitch and speed together, the cheap way, which is what keeps a repeated sound
     * from sounding like a machine gun. Leave out for no variation.
     */
    pitch?: readonly [min: number, max: number];
    /** How far the volume may drop at random per play, 0..1 (0.2 = between 80% and 100%). */
    volumeJitter?: number;
    /** At most this many copies playing at once; the oldest is cut for a new one. */
    maxVoices?: number;
    /** Repeats closer than this (seconds) are dropped: five enemies hit in one frame make one sound. */
    cooldown?: number;
};

export const SOUNDS = {
    footstep: {
        files: ['audio/sfx/footstep3.mp3'],
        bus: 'sfx',
        volume: 0.5,
        pitch: [0.9, 1.1],
        volumeJitter: 0.25,
        maxVoices: 2,
    },
    swordSwing: {
        files: ['audio/sfx/sword-woosh.mp3'],
        bus: 'sfx',
        volume: 0.6,
        pitch: [0.9, 1.15],
        volumeJitter: 0.1,
    },
    dash: {
        files: ['audio/sfx/woosh.mp3'],
        bus: 'sfx',
        volume: 0.5,
        pitch: [0.95, 1.1],
    },
    enemyHit: {
        files: ['audio/sfx/hit.mp3'],
        bus: 'sfx',
        volume: 0.45,
        pitch: [0.9, 1.15],
        cooldown: 0.05,
    },
    /** Same file as `enemyHit`, lower and heavier: taking a blow should not sound like landing one. */
    playerHurt: {
        files: ['audio/sfx/hit.mp3'],
        bus: 'sfx',
        volume: 0.8,
        pitch: [0.7, 0.8],
        cooldown: 0.1,
    },
    coin: {
        files: ['audio/sfx/coin.mp3'],
        bus: 'ui',
        volume: 0.5,
        pitch: [0.95, 1.1],
        cooldown: 0.05,
    },
    pageTurn: {
        files: ['audio/sfx/book-page.mp3'],
        bus: 'ui',
        volume: 0.6,
        pitch: [0.85, 1.15],
        volumeJitter: 0.2,
        maxVoices: 3,
    },
} as const satisfies Record<string, SoundDefinition>;

export type SoundId = keyof typeof SOUNDS;

/**
 * Long looping tracks: music and ambience. Apart from `SOUNDS` because they
 * are streamed, not decoded up front: three minutes of decoded stereo is
 * ~80 MB of floats, where a one-shot is a few hundred KB. Credits in `CREDITS.md`.
 */
export type TrackDefinition = {
    file: string;
    bus: AudioBus;
    /** 0..1, before the bus and master volumes. */
    volume: number;
};

export const TRACKS = {
    mainTheme: {
        file: 'audio/music/main-theme.mp3',
        bus: 'music',
        volume: 0.5,
    },
    worldAmbience: {
        file: 'audio/ambience/world.mp3',
        bus: 'ambience',
        volume: 0.4,
    },
} as const satisfies Record<string, TrackDefinition>;

export type TrackId = keyof typeof TRACKS;
