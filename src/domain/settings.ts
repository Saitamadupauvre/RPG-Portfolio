import { events } from '../core/events';
import {
    INPUT_ACTIONS,
    QUALITY_LEVELS,
    VOLUME_CHANNELS,
    type InputAction,
    type KeyBinding,
    type Quality,
    type Settings,
    type VolumeChannel,
} from '../data/settings';
import { isReservedKey } from './input';
import { loadJson, saveJson } from './persistence';

export type { InputAction, KeyBinding, Quality, Settings, VolumeChannel };

const STORAGE_KEY = 'rpg-portfolio:settings';

/**
 * WASD by position: ZQSD on AZERTY, WASD on QWERTZ, the same keys under the
 * left hand. No label: the interface names them from the real layout.
 */
export const DEFAULT_KEYS: Readonly<Record<InputAction, KeyBinding>> = {
    up: { code: 'KeyW', label: '' },
    left: { code: 'KeyA', label: '' },
    down: { code: 'KeyS', label: '' },
    right: { code: 'KeyD', label: '' },
    dash: { code: 'Space', label: '' },
    interact: { code: 'KeyE', label: '' },
    levelUp: { code: 'KeyF', label: '' },
    book: { code: 'KeyB', label: '' },
};

function defaults(): Settings {
    return {
        keys: { ...DEFAULT_KEYS },
        quality: 'high',
        screenShake: true,
        // Under full: the effects are mixed loud, and a first visit should not start at the top.
        volume: { music: 0.6, sfx: 0.8 },
    };
}

function isBinding(value: unknown): value is KeyBinding {
    if (typeof value !== 'object' || value === null) return false;
    const { code, label } = value as Record<string, unknown>;
    return typeof code === 'string' && code.length > 0 && typeof label === 'string';
}

/** Field by field onto the defaults, like `playerProgress`: an option added later never wipes the others. */
function load(): Settings {
    const settings = defaults();
    const saved = loadJson(STORAGE_KEY);
    if (typeof saved !== 'object' || saved === null) return settings;

    const { keys, quality, screenShake, volume } = saved as Record<string, unknown>;
    if ((QUALITY_LEVELS as readonly unknown[]).includes(quality)) settings.quality = quality as Quality;
    if (typeof screenShake === 'boolean') settings.screenShake = screenShake;

    if (typeof volume === 'object' && volume !== null) {
        for (const channel of VOLUME_CHANNELS) {
            const level = (volume as Record<string, unknown>)[channel];
            if (typeof level === 'number' && Number.isFinite(level)) settings.volume[channel] = clamp01(level);
        }
    }

    if (typeof keys === 'object' && keys !== null) {
        for (const action of INPUT_ACTIONS) {
            const binding = (keys as Record<string, unknown>)[action];
            if (isBinding(binding) && !isReservedKey(binding.code)) settings.keys[action] = binding;
        }
    }
    return settings;
}

function clamp01(value: number): number {
    return Math.max(0, Math.min(1, value));
}

const state: Settings = load();

function commit() {
    saveJson(STORAGE_KEY, state);
    events.emit('settingsChanged', state);
}

export function getSettings(): Readonly<Settings> {
    return state;
}

/** The `event.code` currently bound to an action. */
export function keyFor(action: InputAction): string {
    return state.keys[action].code;
}

export function bindingFor(action: InputAction): KeyBinding {
    return state.keys[action];
}


export type RebindResult = 'bound' | 'reserved';

/** Binds `action` to a key. A key another action already uses is swapped, never shared. */
export function rebind(action: InputAction, binding: KeyBinding): RebindResult {
    if (isReservedKey(binding.code)) return 'reserved';

    const previous = state.keys[action];
    const holder = INPUT_ACTIONS.find((other) => other !== action && state.keys[other].code === binding.code);
    if (holder) state.keys[holder] = previous;

    state.keys[action] = { ...binding };
    commit();
    return 'bound';
}

export function resetKeys() {
    state.keys = { ...DEFAULT_KEYS };
    commit();
}

export function setQuality(quality: Quality) {
    if (quality === state.quality) return;
    state.quality = quality;
    commit();
}

export function setScreenShake(enabled: boolean) {
    if (enabled === state.screenShake) return;
    state.screenShake = enabled;
    commit();
}

/** Saved and announced through `volumeChanged` only: no book redraw while the slider is dragged. */
export function setVolume(channel: VolumeChannel, volume: number) {
    const level = clamp01(volume);
    if (level === state.volume[channel]) return;
    state.volume[channel] = level;
    saveJson(STORAGE_KEY, state);
    events.emit('volumeChanged', channel, level);
}
