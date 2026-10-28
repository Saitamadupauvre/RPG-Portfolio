import { AUDIO_BUSES, SOUNDS, type AudioBus, type SoundDefinition, type SoundId } from '../data/sounds';

/**
 * The one sound player, on the Web Audio API. Imported by both `game/` and `ui/`
 * (a hit and a page turn go through the same mixer), so it knows neither: it
 * only reads the `data/sounds.ts` table.
 *
 * Graph: each play = BufferSource -> its own Gain -> bus Gain -> master Gain -> speakers.
 * A gain per play is what lets two copies of one sound sit at different volumes.
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

let context: AudioContext | null = null;
let master: GainNode | null = null;
const buses = new Map<AudioBus, GainNode>();

/** Decoded files by path. Variants sharing a file (enemyHit / playerHurt) decode it once. */
const buffers = new Map<string, AudioBuffer>();
const loading = new Map<string, Promise<void>>();

const voices = new Map<SoundId, Voice[]>();
const lastVariant = new Map<SoundId, number>();
const lastPlayed = new Map<SoundId, number>();

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

    const unlock = () => {
        void context?.resume();
        if (context?.state === 'running') {
            window.removeEventListener('pointerdown', unlock, true);
            window.removeEventListener('keydown', unlock, true);
        }
    };
    window.addEventListener('pointerdown', unlock, true);
    window.addEventListener('keydown', unlock, true);

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
