import type { ChestLoot, MapEntity } from '../../data/MapEntity';
import { projects } from '../../data/projects';
import type { StatId } from '../../data/stats';

/**
 * Declarative description of one editable field. The inspector renders from these
 * instead of hand-writing a form per entity kind, so a new kind is one table entry
 * — the same dispatch style as `entityFactories.ts` and `entityDefaults.ts`.
 */
export type FieldSpec =
    | { control: 'text'; key: string; label: string }
    | { control: 'select'; key: string; label: string; options: readonly { value: string; label: string }[] }
    | { control: 'checkbox'; key: string; label: string };

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
    enemy: [{ control: 'select', key: 'enemyType', label: 'type', options: options('grunt', 'elite', 'boss') }],
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
        { control: 'text', key: 'propType', label: 'propType' },
        { control: 'checkbox', key: 'collidable', label: 'collidable' },
    ],
    statue: [{ control: 'select', key: 'projectId', label: 'project', options: projectOptions }],
    bonfire: [],
};

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
