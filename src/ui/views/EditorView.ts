import { events } from '../../core/events';
import { tileMap } from '../../data/tileMap';
import type { ChestLoot, MapEntity, TriggerAction, Vec3 } from '../../data/MapEntity';
import {
    actionFieldByKind,
    defaultLoot,
    defaultTriggerAction,
    fieldsByKind,
    lootFieldByKind,
    palette,
    type FieldSpec,
} from './editorFields';
import { button, input, numberField, numberInput, row } from './editorControls';
import { mountScatterPanel } from './editorScatterPanel';
import { DEFAULT_TILE_BRUSH_RADIUS } from '../../core/editorTools';

const gizmoModes = [
    { mode: 'translate', label: 'Move (W)' },
    { mode: 'rotate', label: 'Rotate (E)' },
    { mode: 'scale', label: 'Scale (R)' },
] as const;

const AXES = ['x', 'y', 'z'] as const;

/**
 * The panel's markup lives here rather than in index.html: the editor is
 * dev-only, and markup in the page would ship to production as a hidden panel.
 */
const PANEL_HTML = `
    <h3 class="pixel-text">Editor (F1)</h3>
    <div id="editor-modes" class="editor-row"></div>
    <div id="editor-tiles" class="editor-row"></div>
    <div id="editor-grid-size" class="editor-row"></div>
    <p id="editor-tile-status" class="editor-hint"></p>
    <div id="editor-palette" class="editor-row"></div>
    <div id="editor-scatter" class="editor-scatter"></div>
    <div id="editor-inspector"></div>
    <div class="editor-row">
      <button class="btn editor-btn" id="btn-editor-undo" disabled>Undo</button>
      <button class="btn editor-btn" id="btn-editor-redo" disabled>Redo</button>
    </div>
    <div class="editor-row">
      <span id="editor-count" class="pixel-text">0 entities</span>
      <button class="btn editor-btn" id="btn-editor-copy">Copy JSON</button>
      <button class="btn editor-btn" id="btn-editor-copy-terrain">Copy tiles</button>
      <button class="btn editor-btn" id="btn-editor-export">Export JSON</button>
      <button class="btn editor-btn" id="btn-editor-reset">Reset</button>
    </div>
    <p class="editor-hint">F1 toggle · right-drag orbit, middle-drag pan, wheel zoom · click entity to select, ctrl-click to add/remove, drag a box to select (ctrl adds) · Edit tiles: click or box tiles (shift/ctrl adds), Brush paints tiles (ctrl erases), drag the arrow to change level (1 level = walkable step, 2+ = cliff) · click ground to place · click palette again to unarm · Scatter: drag to paint, ctrl-drag erases what the brush paints · W/E/R gizmo · hold Shift for free (unsnapped) placement · Ctrl+D duplicate · X or Del remove · Ctrl+Z undo, Ctrl+Y redo</p>
`;

function mountPanel(): HTMLElement | null {
    const container = document.getElementById('ui-container');
    if (!container) return null;

    const panel = document.createElement('div');
    panel.id = 'editor-panel';
    panel.className = 'pixel-panel';
    panel.innerHTML = PANEL_HTML;
    container.appendChild(panel);
    return panel;
}

export function initEditorView() {
    const panel = mountPanel();
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
    const undoBtn = document.getElementById('btn-editor-undo') as HTMLButtonElement | null;
    const redoBtn = document.getElementById('btn-editor-redo') as HTMLButtonElement | null;
    const scatterEl = document.getElementById('editor-scatter');
    if (!panel || !paletteEl || !modesEl || !inspector || !countEl || !exportBtn || !copyBtn || !resetBtn) return;
    if (!tilesEl || !tileStatusEl || !gridSizeEl || !copyTerrainBtn) return;
    if (!undoBtn || !redoBtn || !scatterEl) return;

    // Place mode, tile mode and the scatter brush all own the left mouse button,
    // so arming one disarms the others — otherwise a click would spawn a chest
    // *and* grab a tile.
    let armed: HTMLButtonElement | null = null;
    let tileMode = false;
    let tileBrush = false;
    let tileBrushRadius = DEFAULT_TILE_BRUSH_RADIUS;
    let scatterArmed = false;

    const tileButton = button('Edit tiles', () => setTileMode(!tileMode));
    const brushButton = button('Brush', () => {
        tileBrush = !tileBrush;
        brushButton.classList.toggle('armed', tileBrush);
        // The brush only paints tiles, so turning it on implies tile mode.
        if (tileBrush && !tileMode) setTileMode(true);
        pushTileBrush();
    });
    const pushTileBrush = () => events.emit('editorTileBrushChanged', tileBrush, tileBrushRadius);
    tilesEl.append(tileButton, brushButton, numberField('radius', tileBrushRadius, (value) => {
        tileBrushRadius = Math.max(0.5, value);
        pushTileBrush();
    }, false));

    const disarmPalette = () => {
        armed?.classList.remove('armed');
        armed = null;
        events.emit('editorPlaceKindChanged', null, '');
    };

    const setTileMode = (enabled: boolean) => {
        tileMode = enabled;
        tileButton.classList.toggle('armed', enabled);
        events.emit('editorTileModeChanged', enabled);
        if (enabled) {
            disarmPalette();
            if (scatterArmed) setScatterArmed(false);
        }
    };

    const scatterButton = button('Scatter brush', () => setScatterArmed(!scatterArmed));
    scatterEl.appendChild(scatterButton);
    const scatterSettings = mountScatterPanel(scatterEl);

    const setScatterArmed = (enabled: boolean) => {
        scatterArmed = enabled;
        scatterButton.classList.toggle('armed', enabled);
        if (enabled) {
            disarmPalette();
            if (tileMode) setTileMode(false);
            // The editor system is created lazily, after this panel; re-sending
            // the settings on every arm means it can never brush with stale ones.
            events.emit('editorScatterChanged', scatterSettings());
        }
        events.emit('editorScatterArmed', enabled);
    };

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
    gridSizeEl.appendChild(numberField('water', tileMap.waterLevel ?? 0, (value) => {
        events.emit('editorWaterLevelChanged', value);
    }, false));

    for (const entry of palette) {
        const paletteButton = button(entry.label, () => {
            const disarm = armed === paletteButton;
            armed?.classList.remove('armed');
            armed = disarm ? null : paletteButton;
            armed?.classList.add('armed');
            if (!disarm && tileMode) setTileMode(false);
            if (!disarm && scatterArmed) setScatterArmed(false);

            // Disarming must send a null kind, otherwise the editor stays in place
            // mode and clicking the world can never select anything again.
            events.emit('editorPlaceKindChanged', disarm ? null : entry.kind, disarm ? '' : entry.variant);
            if (disarm) events.emit('editorSelectionChanged', []);
        });
        paletteEl.appendChild(paletteButton);
    }

    for (const { mode, label } of gizmoModes) {
        modesEl.appendChild(button(label, () => events.emit('editorGizmoChanged', mode)));
    }

    undoBtn.addEventListener('click', () => events.emit('editorUndoRequested'));
    redoBtn.addEventListener('click', () => events.emit('editorRedoRequested'));
    events.on('editorHistoryChanged', (canUndo, canRedo) => {
        undoBtn.disabled = !canUndo;
        redoBtn.disabled = !canRedo;
    });

    const box = document.createElement('div');
    box.id = 'editor-box';
    document.body.appendChild(box);
    events.on('editorBoxChanged', (rect) => {
        box.style.display = rect ? 'block' : 'none';
        if (!rect) return;
        box.style.left = `${rect.left}px`;
        box.style.top = `${rect.top}px`;
        box.style.width = `${rect.width}px`;
        box.style.height = `${rect.height}px`;
    });

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

    events.on('editorSelectionChanged', (entities) => {
        if (entities.length === 1) inspector.replaceChildren(renderInspector(entities[0]));
        else inspector.replaceChildren(hint(entities.length === 0 ? 'Nothing selected' : `${entities.length} selected`));
    });

    events.on('editorTileSelectionChanged', (count, level) => {
        if (count === 0) {
            tileStatusEl.textContent = tileMode ? 'Click or box tiles · shift/ctrl adds' : '';
            return;
        }

        const height = level === null ? 'mixed levels' : `level ${level}`;
        tileStatusEl.textContent = `${count} tile${count === 1 ? '' : 's'} · ${height}`;
    });

    events.on('editorLayoutChanged', (count) => {
        countEl.textContent = `${count} entities`;
    });
}

function hint(message: string): HTMLElement {
    const text = document.createElement('p');
    text.className = 'editor-hint';
    text.textContent = message;
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
    // Height above (negative: into) the ground; pos Y is only where it ended up.
    form.appendChild(row('height', numberInput(draft.heightOffset ?? 0, (value) => {
        if (value === 0) delete draft.heightOffset;
        else draft.heightOffset = value;
        commit();
    })));
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
    if (draft.kind === 'trigger') form.appendChild(actionEditor(draft, commit));

    return form;
}

/** The trigger's action: its kind, then that kind's one payload field. */
function actionEditor(trigger: { action: TriggerAction }, commit: () => void): HTMLElement {
    const box = document.createElement('div');
    box.className = 'editor-loot';

    const rebuild = () => {
        const kindSelect = control(
            {
                control: 'select',
                key: 'kind',
                label: 'action',
                options: Object.keys(actionFieldByKind).map((kind) => ({ value: kind, label: kind })),
            },
            trigger.action.kind,
            (value) => {
                trigger.action = defaultTriggerAction(value as TriggerAction['kind']);
                rebuild();
                commit();
            },
        );

        const spec = actionFieldByKind[trigger.action.kind];
        const record = trigger.action as unknown as Record<string, unknown>;
        const payload = control(spec, record[spec.key], (value) => {
            record[spec.key] = value;
            commit();
        });

        box.replaceChildren(row('action', kindSelect), row(spec.label, payload));
    };

    rebuild();
    return box;
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
