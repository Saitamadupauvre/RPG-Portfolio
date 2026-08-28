import { events } from '../../core/events';
import type { MapEntity } from '../../data/MapEntity';
import { projects } from '../../data/projects';

type PaletteEntry = { kind: MapEntity['kind']; variant: string; label: string };

const palette: PaletteEntry[] = [
    { kind: 'enemy', variant: 'grunt', label: 'Grunt' },
    { kind: 'enemy', variant: 'elite', label: 'Elite' },
    { kind: 'enemy', variant: 'boss', label: 'Boss' },
    { kind: 'prop', variant: 'wall', label: 'Wall' },
    { kind: 'prop', variant: 'decor', label: 'Decor' },
    { kind: 'chest', variant: 'wood', label: 'Chest (wood)' },
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

export function initEditorView() {
    const panel = document.getElementById('editor-panel');
    const paletteEl = document.getElementById('editor-palette');
    const modesEl = document.getElementById('editor-modes');
    const inspector = document.getElementById('editor-inspector');
    const countEl = document.getElementById('editor-count');
    const exportBtn = document.getElementById('btn-editor-export');
    if (!panel || !paletteEl || !modesEl || !inspector || !countEl || !exportBtn) return;

    let armed: HTMLButtonElement | null = null;

    for (const entry of palette) {
        const button = document.createElement('button');
        button.className = 'btn editor-btn';
        button.textContent = entry.label;
        button.addEventListener('click', () => {
            const disarm = armed === button;
            armed?.classList.remove('armed');
            armed = disarm ? null : button;
            armed?.classList.add('armed');

            events.emit('editorPlaceKindChanged', entry.kind, disarm ? '' : entry.variant);
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

    exportBtn.addEventListener('click', () => events.emit('editorExportRequested'));

    events.on('editorSelectionChanged', (entity) => {
        inspector.textContent = entity ? describe(entity) : 'Nothing selected';
    });

    events.on('editorLayoutChanged', (count) => {
        countEl.textContent = `${count} entities`;
    });
}

function describe(entity: MapEntity): string {
    const round = (values: number[] | undefined, fallback: number) =>
        (values ?? [fallback, fallback, fallback]).map((value) => value.toFixed(2)).join(', ');

    return [
        `${entity.kind} — ${entity.id}`,
        `pos  ${round(entity.position, 0)}`,
        `rot  ${round(entity.rotation, 0)}`,
        `scl  ${round(entity.scale, 1)}`,
    ].join('\n');
}
