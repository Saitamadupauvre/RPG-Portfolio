/**
 * The campfire models a bonfire can wear (tools/blender/make_campfires.py). They are
 * logs and stones only; the flames are a particle effect the game adds. Pure content:
 * which models exist and how big each stands.
 */
export type BonfireModelDef = {
    url: string;
    /** World height the model is fitted to. */
    height: number;
    /** Where the fire sits above the ground, at the middle of the logs. */
    fireHeight: number;
};

export const BONFIRE_MODELS = {
    // Cooking pot hanging from a tripod, round stones.
    'campfire-3': { url: 'campfires/campfire-3.glb', height: 2.0, fireHeight: 0.15 },
    // Plain logs, round stones.
    'campfire-4': { url: 'campfires/campfire-4.glb', height: 0.55, fireHeight: 0.15 },
} as const satisfies Record<string, BonfireModelDef>;

export type BonfireModelId = keyof typeof BONFIRE_MODELS;

export const BONFIRE_MODEL_IDS = Object.keys(BONFIRE_MODELS) as BonfireModelId[];

/** What a bonfire without an authored model wears. */
export const DEFAULT_BONFIRE_MODEL: BonfireModelId = 'campfire-4';

export function isBonfireModel(id: string): id is BonfireModelId {
    return id in BONFIRE_MODELS;
}

export function randomBonfireModel(): BonfireModelId {
    return BONFIRE_MODEL_IDS[Math.floor(Math.random() * BONFIRE_MODEL_IDS.length)];
}
