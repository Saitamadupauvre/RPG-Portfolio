import { events } from '../../core/events';
import { tileMap } from '../../data/tileMap';
import type { ChestLoot, MapEntity, Vec3 } from '../../data/MapEntity';
import { projects } from '../../data/projects';
import { defaultLoot, fieldsByKind, lootFieldByKind, type FieldSpec } from './editorFields';

type PaletteEntry = { kind: MapEntity['kind']; variant: string; label: string };

const palette: PaletteEntry[] = [
    { kind: 'enemy', variant: 'grunt', label: 'Grunt' },
    { kind: 'enemy', variant: 'elite', label: 'Elite' },
    { kind: 'enemy', variant: 'boss', label: 'Boss' },
    { kind: 'prop', variant: 'wall', label: 'Wall' },
    { kind: 'prop', variant: 'decor', label: 'Decor' },
    { kind: 'chest', variant: 'wood', label: 'Chest (wood)' },
    { kind: 'chest', variant: 'silver', label: 'Chest (silver)' },
    { kind: 'chest', variant: 'gold', label: 'Chest (gold)' },
    { kind: 'item', variant: 'shard', label: 'Item' },
    { kind: 'bonfire', variant: '', label: 'Bonfire' },
    ...projects.map((project) => ({
        kind: 'statue' as const,
        variant: project.id,
        label: `Statue: ${project.title}`,
    })),
];

const gizmoModes = [
    { mode: 'translate', label: 'Move (W)' },
    { mode: 'rotate', label: 'Rotate (E)' },
    { mode: 'scale', label: 'Scale (R)' },
] as const;

const AXES = ['x', 'y', 'z'] as const;

export function initEditorView() {
    const panel = document.getElementById('editor-panel');
    const paletteEl = document.getElementById('editor-palette');
    const modesEl = document.getElementById('editor-modes');
    const inspector = document.getElementById('editor-inspector');
    const countEl = document.getElementById('editor-count');
    const tilesEl = document.getElementById('editor-tiles');
    const gridSizeEl = document.getElementById('editor-grid-size');
    const tileStatusEl = document.getElementById('editor-tile-status');
    const copyTerrainBtn = document.getElementById('btn-editor-copy-terrain');
    const exportBtn = document.getElementById('btn-editor-export');
    const copyBtn = document.getElementById('btn-editor-copy');
    const resetBtn = document.getElementById('btn-editor-reset');
    if (!panel || !paletteEl || !modesEl || !inspector || !countEl || !exportBtn || !copyBtn || !resetBtn) return;
    if (!tilesEl || !tileStatusEl || !gridSizeEl || !copyTerrainBtn) return;

    // Place mode and tile mode both own the left mouse button, so arming one
    // disarms the other — otherwise a click would spawn a chest *and* grab a tile.
    let armed: HTMLButtonElement | null = null;
    let tileMode = false;

    const tileButton = document.createElement('button');
    tileButton.className = 'btn editor-btn';
    tileButton.textContent = 'Edit tiles';
    tilesEl.appendChild(tileButton);

    const disarmPalette = () => {
        armed?.classList.remove('armed');
        armed = null;
        events.emit('editorPlaceKindChanged', null, '');
    };

    const setTileMode = (enabled: boolean) => {
        tileMode = enabled;
        tileButton.classList.toggle('armed', enabled);
        events.emit('editorTileModeChanged', enabled);
        if (enabled) disarmPalette();
    };

    tileButton.addEventListener('click', () => setTileMode(!tileMode));

    let cols = tileMap.cols;
    let rows = tileMap.rows;
    const pushGridSize = () => events.emit('editorTileGridResized', cols, rows);

    gridSizeEl.appendChild(numberField('cols', cols, (value) => {
        cols = value;
        pushGridSize();
    }));
    gridSizeEl.appendChild(numberField('rows', rows, (value) => {
        rows = value;
        pushGridSize();
    }));

    for (const entry of palette) {
        const button = document.createElement('button');
        button.className = 'btn editor-btn';
        button.textContent = entry.label;
        button.addEventListener('click', () => {
            const disarm = armed === button;
            armed?.classList.remove('armed');
            armed = disarm ? null : button;
            armed?.classList.add('armed');
            if (!disarm && tileMode) setTileMode(false);

            // Disarming must send a null kind, otherwise the editor stays in place
            // mode and clicking the world can never select anything again.
            events.emit('editorPlaceKindChanged', disarm ? null : entry.kind, disarm ? '' : entry.variant);
            if (disarm) events.emit('editorSelectionChanged', null);
        });
        paletteEl.appendChild(button);
    }

    for (const { mode, label } of gizmoModes) {
        const button = document.createElement('button');
        button.className = 'btn editor-btn';
        button.textContent = label;
        button.addEventListener('click', () => events.emit('editorGizmoChanged', mode));
        modesEl.appendChild(button);
    }

    copyTerrainBtn.addEventListener('click', () => {
        events.emit('editorTerrainCopyRequested');
        copyTerrainBtn.textContent = 'Copied!';
        setTimeout(() => (copyTerrainBtn.textContent = 'Copy tiles'), 1200);
    });

    exportBtn.addEventListener('click', () => events.emit('editorExportRequested'));

    copyBtn.addEventListener('click', () => {
        events.emit('editorCopyRequested');
        copyBtn.textContent = 'Copied!';
        setTimeout(() => (copyBtn.textContent = 'Copy JSON'), 1200);
    });

    resetBtn.addEventListener('click', () => {
        if (!confirm('Discard local edits and reload mapLayout.ts?')) return;
        events.emit('editorResetRequested');
    });

    events.on('editorSelectionChanged', (entity) => {
        inspector.replaceChildren(entity ? renderInspector(entity) : emptyState());
    });

    events.on('editorTileSelectionChanged', (count, level) => {
        if (count === 0) {
            tileStatusEl.textContent = tileMode ? 'Click a tile · shift-click adds' : '';
            return;
        }

        const height = level === null ? 'mixed levels' : `level ${level}`;
        tileStatusEl.textContent = `${count} tile${count === 1 ? '' : 's'} · ${height}`;
    });

    events.on('editorLayoutChanged', (count) => {
        countEl.textContent = `${count} entities`;
    });
}

function numberField(label: string, value: number, onChange: (value: number) => void): HTMLElement {
    const field = input('number', String(value), (raw) => {
        const parsed = Math.round(Number(raw));
        if (Number.isFinite(parsed) && parsed > 0) onChange(parsed);
    });
    field.classList.add('editor-number');

    return row(label, field);
}

function emptyState(): HTMLElement {
    const text = document.createElement('p');
    text.className = 'editor-hint';
    text.textContent = 'Nothing selected';
    return text;
}

/**
 * Builds the form for one entity. Every control mutates a working copy and emits
 * `editorEntityEdited`; the editor system owns the layout, this view never does.
 * Commits happen on `change` (not `input`) because each commit rebuilds the world.
 */
function renderInspector(entity: MapEntity): HTMLElement {
    const draft = structuredClone(entity) as MapEntity;
    const commit = () => events.emit('editorEntityEdited', draft);

    const form = document.createElement('div');
    form.className = 'editor-fields';

    const header = document.createElement('p');
    header.className = 'editor-kind';
    header.textContent = draft.kind;
    form.appendChild(header);

    form.appendChild(
        row('id', input('text', draft.id, (value) => {
            draft.id = value;
            commit();
        })),
    );

    form.appendChild(vectorRow('pos', draft.position, (value) => {
        draft.position = value;
        commit();
    }));
    form.appendChild(vectorRow('rot', draft.rotation ?? [0, 0, 0], (value) => {
        draft.rotation = value;
        commit();
    }));
    form.appendChild(vectorRow('scl', draft.scale ?? [1, 1, 1], (value) => {
        draft.scale = value;
        commit();
    }));

    const record = draft as unknown as Record<string, unknown>;
    for (const spec of fieldsByKind[draft.kind]) {
        form.appendChild(row(spec.label, control(spec, record[spec.key], (value) => {
            record[spec.key] = value;
            commit();
        })));
    }

    if (draft.kind === 'chest') form.appendChild(lootEditor(draft.loot, commit));

    return form;
}

function lootEditor(loot: ChestLoot[], commit: () => void): HTMLElement {
    const box = document.createElement('div');
    box.className = 'editor-loot';

    const rebuild = () => {
        box.replaceChildren();

        const title = document.createElement('p');
        title.className = 'editor-kind';
        title.textContent = 'loot';
        box.appendChild(title);

        loot.forEach((entry, index) => {
            const line = document.createElement('div');
            line.className = 'editor-field';

            const kindSelect = control(
                { control: 'select', key: 'kind', label: 'kind', options: [
                    { value: 'coins', label: 'coins' },
                    { value: 'project', label: 'project' },
                    { value: 'stat', label: 'stat' },
                ] },
                entry.kind,
                (value) => {
                    loot[index] = defaultLoot(value as ChestLoot['kind']);
                    rebuild();
                    commit();
                },
            );
            line.appendChild(kindSelect);

            const spec = lootFieldByKind[entry.kind];
            const record = entry as unknown as Record<string, unknown>;
            line.appendChild(control(spec, record[spec.key], (value) => {
                // `amount` is the only numeric loot payload; the rest are ids.
                record[spec.key] = spec.key === 'amount' ? Number(value) || 0 : value;
                commit();
            }));

            const remove = document.createElement('button');
            remove.className = 'btn editor-btn';
            remove.textContent = '×';
            remove.addEventListener('click', () => {
                loot.splice(index, 1);
                rebuild();
                commit();
            });
            line.appendChild(remove);

            box.appendChild(line);
        });

        const add = document.createElement('button');
        add.className = 'btn editor-btn';
        add.textContent = '+ loot';
        add.addEventListener('click', () => {
            loot.push(defaultLoot('coins'));
            rebuild();
            commit();
        });
        box.appendChild(add);
    };

    rebuild();
    return box;
}

function control(spec: FieldSpec, value: unknown, onChange: (value: string | boolean) => void): HTMLElement {
    if (spec.control === 'checkbox') {
        const box = document.createElement('input');
        box.type = 'checkbox';
        box.checked = value === true;
        box.addEventListener('change', () => onChange(box.checked));
        return box;
    }

    if (spec.control === 'select') {
        const select = document.createElement('select');
        select.className = 'editor-input';
        for (const option of spec.options) {
            const element = document.createElement('option');
            element.value = option.value;
            element.textContent = option.label;
            select.appendChild(element);
        }
        select.value = String(value ?? '');
        select.addEventListener('change', () => onChange(select.value));
        return select;
    }

    return input('text', String(value ?? ''), onChange);
}

function input(type: 'text' | 'number', value: string, onChange: (value: string) => void): HTMLInputElement {
    const element = document.createElement('input');
    element.type = type;
    element.className = 'editor-input';
    element.value = value;
    if (type === 'number') element.step = '0.5';
    element.addEventListener('change', () => onChange(element.value));
    return element;
}

function vectorRow(label: string, value: Vec3, onChange: (value: Vec3) => void): HTMLElement {
    const next: Vec3 = [...value];
    const fields = document.createElement('div');
    fields.className = 'editor-vector';

    AXES.forEach((_axis, index) => {
        fields.appendChild(
            input('number', String(next[index]), (raw) => {
                next[index] = Number(raw) || 0;
                onChange([...next]);
            }),
        );
    });

    return row(label, fields);
}

function row(label: string, field: HTMLElement): HTMLElement {
    const line = document.createElement('label');
    line.className = 'editor-field';

    const text = document.createElement('span');
    text.textContent = label;
    line.appendChild(text);
    line.appendChild(field);

    return line;
}
