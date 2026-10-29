import { events } from '../../core/events';
import { DEFAULT_SCATTER, type ScatterEntry, type ScatterSettings } from '../../core/editorTools';
import { loadJson, saveJson } from '../../domain/persistence';
import { button, group, numberField, numberInput, row } from './editorControls';
import { PROP_MODEL_IDS } from '../../data/propModels';
import { palette, type PaletteEntry } from './editorFields';

const STORAGE_KEY = 'rpg-portfolio:editor-scatter';

function isScatterSettings(value: unknown): value is ScatterSettings {
    if (typeof value !== 'object' || value === null) return false;

    const settings = value as Partial<ScatterSettings>;
    return typeof settings.radius === 'number'
        && typeof settings.minDistance === 'number'
        && typeof settings.stampSpacing === 'number'
        && Array.isArray(settings.entries);
}

function loadSettings(): ScatterSettings {
    const stored = loadJson(STORAGE_KEY);
    return isScatterSettings(stored) ? stored : structuredClone(DEFAULT_SCATTER);
}

/**
 * The palette, plus every prop model by name, for a brush of exactly one rock.
 * Triggers are left out: a volume is placed on purpose, never sprinkled.
 */
const options: PaletteEntry[] = [
    ...palette.filter((entry) => entry.kind !== 'trigger'),
    ...PROP_MODEL_IDS.map((id): PaletteEntry => ({ kind: 'prop', variant: id, label: id })),
];

const paletteKey = (kind: string, variant: string) => `${kind}:${variant}`;

/**
 * The scatter brush settings form. It owns the settings, saves them on every
 * edit, and sends a copy to the editor system: a copy, so the game layer can
 * never hold a reference this form keeps mutating behind its back.
 */
export function mountScatterPanel(container: HTMLElement): () => ScatterSettings {
    const settings = loadSettings();
    const current = () => structuredClone(settings);

    const changed = () => {
        saveJson(STORAGE_KEY, settings);
        events.emit('editorScatterChanged', current());
    };

    const brushFields = document.createElement('div');
    brushFields.className = 'editor-fields';
    brushFields.append(
        numberField('radius', settings.radius, (value) => {
            settings.radius = Math.max(0.5, value);
            changed();
        }, false),
        numberField('min gap', settings.minDistance, (value) => {
            settings.minDistance = Math.max(0, value);
            changed();
        }, false),
        numberField('spacing', settings.stampSpacing, (value) => {
            settings.stampSpacing = Math.max(0.25, value);
            changed();
        }, false),
    );

    const list = document.createElement('div');
    list.className = 'editor-fields';

    const rebuild = () => {
        list.replaceChildren(...settings.entries.map((entry, index) => entryForm(entry, () => {
            settings.entries.splice(index, 1);
            rebuild();
            changed();
        }, changed)));
    };

    const add = button('+ item', () => {
        settings.entries.push(structuredClone(DEFAULT_SCATTER.entries[0]));
        rebuild();
        changed();
    });

    rebuild();
    container.append(brushFields, list, add);
    return current;
}

function entryForm(entry: ScatterEntry, onRemove: () => void, changed: () => void): HTMLElement {
    const box = document.createElement('div');
    box.className = 'editor-scatter-entry';

    const select = document.createElement('select');
    select.className = 'editor-input';
    for (const option of options) {
        const element = document.createElement('option');
        element.value = paletteKey(option.kind, option.variant);
        element.textContent = option.label;
        select.appendChild(element);
    }
    select.value = paletteKey(entry.kind, entry.variant);
    select.addEventListener('change', () => {
        const picked = options.find((option) => paletteKey(option.kind, option.variant) === select.value);
        if (!picked) return;
        entry.kind = picked.kind;
        entry.variant = picked.variant;
        changed();
    });

    const count = numberInput(entry.count, (value) => {
        entry.count = Math.max(0, Math.round(value));
        changed();
    });
    count.title = 'copies per stamp';

    const set = (key: 'rotationMin' | 'rotationMax' | 'tilt' | 'scaleMin' | 'scaleMax') =>
        numberInput(entry[key], (value) => {
            entry[key] = value;
            changed();
        });

    box.append(
        group('item', select, count, button('×', onRemove)),
        group('rot °', set('rotationMin'), set('rotationMax')),
        group('scale', set('scaleMin'), set('scaleMax')),
        row('tilt °', set('tilt')),
    );
    return box;
}
