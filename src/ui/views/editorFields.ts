import type { ChestLoot, MapEntity, TriggerAction } from '../../data/MapEntity';
import { BONFIRE_MODEL_IDS } from '../../data/bonfireModels';
import { projects } from '../../data/projects';
import { PROP_MODEL_IDS } from '../../data/propModels';
import type { StatId } from '../../data/stats';
import { TUTORIAL_IDS } from '../../data/tutorials';

/**
 * Declarative description of one editable field. The inspector renders from these
 * instead of hand-writing a form per entity kind, so a new kind is one table entry
 * — the same dispatch style as `entityFactories.ts` and `entityDefaults.ts`.
 */
export type FieldSpec =
    | { control: 'text'; key: string; label: string }
    | { control: 'select'; key: string; label: string; options: readonly { value: string; label: string }[] }
    | { control: 'checkbox'; key: string; label: string };

export type PaletteEntry = { kind: MapEntity['kind']; variant: string; label: string };

/** What the editor can place, both from the palette buttons and from the scatter brush. */
export const palette: PaletteEntry[] = [
    { kind: 'enemy', variant: 'grunt', label: 'Grunt' },
    { kind: 'enemy', variant: 'elite', label: 'Elite' },
    { kind: 'enemy', variant: 'archer', label: 'Archer' },
    { kind: 'enemy', variant: 'boss', label: 'Boss' },
    { kind: 'prop', variant: 'tree', label: 'Tree (random)' },
    { kind: 'prop', variant: 'bush', label: 'Bush (random)' },
    { kind: 'prop', variant: 'rock', label: 'Rock (random)' },
    { kind: 'chest', variant: '', label: 'Chest' },
    { kind: 'item', variant: 'shard', label: 'Item' },
    { kind: 'bonfire', variant: '', label: 'Bonfire' },
    { kind: 'statue', variant: '', label: 'Statue' },
    { kind: 'trigger', variant: 'movement', label: 'Trigger' },
];

const projectOptions = projects.map((project) => ({ value: project.id, label: project.title }));
const statOptions: { value: StatId; label: string }[] = [
    { value: 'health', label: 'health' },
    { value: 'damage', label: 'damage' },
    { value: 'speed', label: 'speed' },
];

function options(...values: string[]) {
    return values.map((value) => ({ value, label: value }));
}

/** Fields specific to each entity kind. Shared transform fields are rendered separately. */
export const fieldsByKind: Record<MapEntity['kind'], readonly FieldSpec[]> = {
    enemy: [{ control: 'select', key: 'enemyType', label: 'type', options: options('grunt', 'elite', 'archer', 'boss') }],
    chest: [{ control: 'select', key: 'chestTier', label: 'tier', options: options('wood', 'silver', 'gold') }],
    item: [
        { control: 'text', key: 'itemType', label: 'itemType' },
        {
            control: 'select',
            key: 'projectId',
            label: 'project',
            options: [{ value: '', label: '(none)' }, ...projectOptions],
        },
    ],
    prop: [
        { control: 'select', key: 'propType', label: 'model', options: options(...PROP_MODEL_IDS) },
        { control: 'select', key: 'material', label: 'rock material', options: options('stone', 'cliff') },
    ],
    statue: [{ control: 'select', key: 'projectId', label: 'project', options: projectOptions }],
    bonfire: [{ control: 'select', key: 'model', label: 'model', options: options(...BONFIRE_MODEL_IDS) }],
    // Its one field is nested in `action`: drawn by the inspector's action editor instead.
    trigger: [],
};

/** The payload field of each trigger action, keyed by the action's own `kind` tag (like the loot below). */
export const actionFieldByKind: Record<TriggerAction['kind'], FieldSpec> = {
    tutorial: { control: 'select', key: 'tutorialId', label: 'tutorial', options: options(...TUTORIAL_IDS) },
};

export function defaultTriggerAction(kind: TriggerAction['kind']): TriggerAction {
    switch (kind) {
        case 'tutorial':
            return { kind: 'tutorial', tutorialId: TUTORIAL_IDS[0] };
    }
}

/** The one payload field each loot kind carries, keyed by the loot's own `kind` tag. */
export const lootFieldByKind: Record<ChestLoot['kind'], FieldSpec> = {
    coins: { control: 'text', key: 'amount', label: 'amount' },
    project: { control: 'select', key: 'projectId', label: 'project', options: projectOptions },
    stat: { control: 'select', key: 'statId', label: 'stat', options: statOptions },
};

export function defaultLoot(kind: ChestLoot['kind']): ChestLoot {
    switch (kind) {
        case 'coins':
            return { kind: 'coins', amount: 25 };
        case 'project':
            return { kind: 'project', projectId: projects[0]?.id ?? '' };
        case 'stat':
            return { kind: 'stat', statId: 'health' };
    }
}
