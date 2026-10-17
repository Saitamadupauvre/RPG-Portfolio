/**
 * Props that are a real model rather than a primitive. Pure content: which models
 * exist, what kind each is, and how big it stands in the world. All are the
 * KayKit Forest Nature Pack (CC0), converted by tools/blender/make_nature.py.
 *
 * The kind picks the behaviour: trees and bushes re-tint their leaves and sway
 * in the wind, rocks wear the terrain's ground shader (grass on top, rock on the sides).
 */
export type PropModelKind = 'tree' | 'bush' | 'rock';

export type PropModelDef = {
    kind: PropModelKind;
    url: string;
    /** World height the model is fitted to. */
    height: number;
    /** Solid footprint of the unscaled model; 0 = walk straight through (bushes). A tree's canopy never blocks, only its trunk. */
    radius: number;
};

export const PROP_MODELS = {
    'tree-1-a': { kind: 'tree', url: 'nature/tree-1-a.glb', height: 3.6, radius: 0.4 },
    'tree-1-b': { kind: 'tree', url: 'nature/tree-1-b.glb', height: 4.2, radius: 0.35 },
    'tree-1-c': { kind: 'tree', url: 'nature/tree-1-c.glb', height: 5.5, radius: 0.5 },
    'tree-bare-1-b': { kind: 'tree', url: 'nature/tree-bare-1-b.glb', height: 3.0, radius: 0.25 },
    'tree-bare-2-c': { kind: 'tree', url: 'nature/tree-bare-2-c.glb', height: 5.0, radius: 0.2 },

    'bush-1-a': { kind: 'bush', url: 'nature/bush-1-a.glb', height: 0.5, radius: 0 },
    'bush-1-e': { kind: 'bush', url: 'nature/bush-1-e.glb', height: 0.9, radius: 0 },

    'rock-1-d': { kind: 'rock', url: 'nature/rock-1-d.glb', height: 1.0, radius: 0.45 },
    'rock-1-k': { kind: 'rock', url: 'nature/rock-1-k.glb', height: 1.6, radius: 0.7 },
    'rock-1-l': { kind: 'rock', url: 'nature/rock-1-l.glb', height: 1.5, radius: 0.6 },
    'rock-1-p': { kind: 'rock', url: 'nature/rock-1-p.glb', height: 2.0, radius: 0.5 },
    'rock-3-g': { kind: 'rock', url: 'nature/rock-3-g.glb', height: 1.2, radius: 0.5 },
    'rock-3-k': { kind: 'rock', url: 'nature/rock-3-k.glb', height: 1.2, radius: 0.6 },
    'rock-3-m': { kind: 'rock', url: 'nature/rock-3-m.glb', height: 1.8, radius: 0.75 },
    'rock-3-p': { kind: 'rock', url: 'nature/rock-3-p.glb', height: 1.8, radius: 0.7 },
    'rock-3-q': { kind: 'rock', url: 'nature/rock-3-q.glb', height: 1.8, radius: 1.0 },
    'rock-3-r': { kind: 'rock', url: 'nature/rock-3-r.glb', height: 2.0, radius: 1.2 },
} as const satisfies Record<string, PropModelDef>;

export type PropModelId = keyof typeof PROP_MODELS;

export const PROP_MODEL_IDS = Object.keys(PROP_MODELS) as PropModelId[];

export const PROP_MODEL_KINDS: readonly PropModelKind[] = ['tree', 'bush', 'rock'];

export function isPropModel(propType: string): propType is PropModelId {
    return propType in PROP_MODELS;
}

export function isPropModelKind(value: string): value is PropModelKind {
    return (PROP_MODEL_KINDS as readonly string[]).includes(value);
}

/** One of the kind's models, picked at random: what the editor places for "Tree", "Rock"... */
export function randomModelOfKind(kind: PropModelKind): PropModelId {
    const ids = PROP_MODEL_IDS.filter((id) => PROP_MODELS[id].kind === kind);
    return ids[Math.floor(Math.random() * ids.length)];
}
