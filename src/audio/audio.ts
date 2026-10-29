import {
    AUDIO_BUSES,
    SOUNDS,
    TRACKS,
    type AudioBus,
    type SoundDefinition,
    type SoundId,
    type TrackDefinition,
    type TrackId,
} from '../data/sounds';

/**
 * The one sound player, on the Web Audio API. Imported by both `game/` and `ui/`
 * (a hit and a page turn go through the same mixer), so it knows neither: it
 * only reads the `data/sounds.ts` table.
 *
 * Graph: each play = BufferSource -> its own Gain -> bus Gain -> master Gain -> speakers.
 * A gain per play is what lets two copies of one sound sit at different volumes.
 * Tracks (music, ambience) stream from an <audio> element into the same graph:
 * <audio> -> MediaElementSource -> its own Gain (fades) -> bus Gain -> master.
 */

export type PlayOptions = {
    /** Multiplies the table's volume. */
    volume?: number;
    /** Multiplies the random pitch (2 = an octave up). */
    pitch?: number;
    /** Seconds from now, scheduled on the audio clock (exact, unlike setTimeout). */
    delay?: number;
};

type Voice = { source: AudioBufferSourceNode; gain: GainNode };

type Track = {
    element: HTMLAudioElement;
    gain: GainNode;
    wanted: boolean;
    /** Pauses the element once a fade-out has reached silence. */
    pauseTimer: number;
};

let context: AudioContext | null = null;
let master: GainNode | null = null;
const buses = new Map<AudioBus, GainNode>();

/** Decoded files by path. Variants sharing a file (enemyHit / playerHurt) decode it once. */
const buffers = new Map<string, AudioBuffer>();
const loading = new Map<string, Promise<void>>();

const voices = new Map<SoundId, Voice[]>();
const lastVariant = new Map<SoundId, number>();
const lastPlayed = new Map<SoundId, number>();

const tracks = new Map<TrackId, Track>();

/**
 * Builds the graph and starts decoding every file. Browsers create an
 * AudioContext suspended until the page gets a click or key press (autoplay
 * policy), so it is resumed on the first one.
 */
export function initAudio() {
    if (context || typeof AudioContext === 'undefined') return;

    context = new AudioContext();
    master = context.createGain();
    master.connect(context.destination);
    for (const bus of AUDIO_BUSES) {
        const gain = context.createGain();
        gain.connect(master);
        buses.set(bus, gain);
    }

    let unlocked = false;
    const unlock = () => {
        void context?.resume().then(() => {
            if (context?.state !== 'running') return;
            unlocked = true;
            window.removeEventListener('pointerdown', unlock, true);
            window.removeEventListener('keydown', unlock, true);
        });
    };
    window.addEventListener('pointerdown', unlock, true);
    window.addEventListener('keydown', unlock, true);

    // Silent in a background tab, like the frozen game behind it.
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) void context?.suspend();
        else if (unlocked) void context?.resume();
    });
    // Tracks asked for while locked start here, once sound is allowed.
    context.addEventListener('statechange', () => {
        if (context?.state === 'running') for (const id of tracks.keys()) syncTrack(id, TRACK_FADE_S);
    });

    for (const definition of Object.values(SOUNDS) as SoundDefinition[]) {
        for (const file of definition.files) void load(file);
    }
}

function load(file: string): Promise<void> {
    let pending = loading.get(file);
    if (pending) return pending;

    pending = fetch(file)
        .then((response) => {
            if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
            return response.arrayBuffer();
        })
        .then((data) => context!.decodeAudioData(data))
        .then((buffer) => void buffers.set(file, buffer))
        .catch((error) => {
            // Forgotten so a later play retries, like failed models in `loadModel`.
            loading.delete(file);
            console.warn(`[audio] ${file} failed to load`, error);
        });
    loading.set(file, pending);
    return pending;
}

/** Plays a sound from the table. Silently does nothing while audio is locked or the file is still loading. */
export function playSound(id: SoundId, options: PlayOptions = {}) {
    if (!context || context.state !== 'running') return;
    const definition: SoundDefinition = SOUNDS[id];

    const now = context.currentTime;
    const at = now + (options.delay ?? 0);
    if (definition.cooldown && at - (lastPlayed.get(id) ?? -Infinity) < definition.cooldown) return;

    const file = definition.files[pickVariant(id, definition.files.length)];
    const buffer = buffers.get(file);
    if (!buffer) {
        void load(file);
        return;
    }
    lastPlayed.set(id, at);

    const [low, high] = definition.pitch ?? [1, 1];
    const jitter = definition.volumeJitter ?? 0;

    const source = context.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = random(low, high) * (options.pitch ?? 1);

    const gain = context.createGain();
    gain.gain.value = definition.volume * (1 - Math.random() * jitter) * (options.volume ?? 1);

    source.connect(gain);
    gain.connect(buses.get(definition.bus)!);
    source.start(at);

    trackVoice(id, { source, gain }, definition.maxVoices);
}

/** Random index, never the one played last time when there is a choice. */
function pickVariant(id: SoundId, count: number): number {
    if (count <= 1) return 0;
    const last = lastVariant.get(id) ?? -1;
    // Draw among the others: shifting past `last` keeps every remaining variant equally likely.
    let index = Math.floor(Math.random() * (count - 1));
    if (index >= last && last >= 0) index++;
    lastVariant.set(id, index);
    return index;
}

function trackVoice(id: SoundId, voice: Voice, maxVoices = Infinity) {
    let playing = voices.get(id);
    if (!playing) {
        playing = [];
        voices.set(id, playing);
    }
    playing.push(voice);

    voice.source.onended = () => {
        voice.gain.disconnect();
        const list = voices.get(id);
        const index = list?.indexOf(voice) ?? -1;
        if (index >= 0) list!.splice(index, 1);
    };

    while (playing.length > maxVoices) {
        // stop() fires onended, which drops it from the list.
        playing[0].source.stop();
        playing.shift();
    }
}

// ---------- tracks ----------

/** Default fade in/out, seconds. */
const TRACK_FADE_S = 2;

/** Fades a looping track in. Asked while audio is locked, it starts on the first click or key. */
export function playTrack(id: TrackId, fadeSeconds = TRACK_FADE_S) {
    const track = trackFor(id);
    if (!track || track.wanted) return;
    track.wanted = true;
    syncTrack(id, fadeSeconds);
}

/** Fades a track out, then pauses it where it is. */
export function stopTrack(id: TrackId, fadeSeconds = TRACK_FADE_S) {
    const track = tracks.get(id);
    if (!track?.wanted) return;
    track.wanted = false;
    syncTrack(id, fadeSeconds);
}

/** Created on first use: an <audio> element downloads on its own, no need to fetch it at boot. */
function trackFor(id: TrackId): Track | null {
    if (!context) return null;
    let track = tracks.get(id);
    if (track) return track;

    const definition: TrackDefinition = TRACKS[id];
    const element = new Audio(definition.file);
    element.loop = true;
    element.preload = 'auto';

    const gain = context.createGain();
    gain.gain.value = 0;
    context.createMediaElementSource(element).connect(gain);
    gain.connect(buses.get(definition.bus)!);

    track = { element, gain, wanted: false, pauseTimer: 0 };
    tracks.set(id, track);
    return track;
}

/** Moves the track's gain toward where `wanted` says it should be. */
function syncTrack(id: TrackId, fadeSeconds: number) {
    const track = tracks.get(id);
    if (!context || !track) return;
    // Locked: <audio>.play() would be refused by the autoplay policy. `statechange` retries.
    if (context.state !== 'running') return;

    const now = context.currentTime;
    const param = track.gain.gain;
    // Pin the ramp to where it is now: a new fade starts from the current level, not the last target.
    param.cancelScheduledValues(now);
    param.setValueAtTime(track.element.paused ? 0 : param.value, now);
    // setTargetAtTime approaches its target exponentially; a third of the fade gets ~95% there.
    const timeConstant = Math.max(0.01, fadeSeconds / 3);
    window.clearTimeout(track.pauseTimer);

    if (track.wanted) {
        param.setTargetAtTime(TRACKS[id].volume, now, timeConstant);
        if (track.element.paused) {
            track.element.play().catch((error) => console.warn(`[audio] ${id} failed to play`, error));
        }
    } else {
        param.setTargetAtTime(0, now, timeConstant);
        track.pauseTimer = window.setTimeout(() => track.element.pause(), fadeSeconds * 1000);
    }
}

// ---------- volume ----------

/**
 * 0..1, a slider position. `'master'` scales every bus. Squared into a gain:
 * the ear hears loudness roughly on a log scale, so a linear gain crams every
 * audible change into the slider's bottom fifth and leaves the rest near-full.
 */
export function setVolume(target: AudioBus | 'master', volume: number) {
    const node = target === 'master' ? master : buses.get(target);
    if (!node || !context) return;
    const level = Math.max(0, Math.min(1, volume));
    // A short ramp, not a jump: a gain step mid-sound clicks.
    node.gain.setTargetAtTime(level * level, context.currentTime, 0.015);
}

function random(min: number, max: number): number {
    return min + Math.random() * (max - min);
}
