import type { Vec3 } from '../data/MapEntity';
import { loadJson, saveJson } from './persistence';

const CHECKPOINT_KEY = 'rpg-portfolio:checkpoint';

const DEFAULT_CHECKPOINT: Vec3 = [0, 0, 0];

function isVec3(value: unknown): value is Vec3 {
    return Array.isArray(value)
        && value.length === 3
        && value.every((component) => typeof component === 'number');
}

const stored = loadJson(CHECKPOINT_KEY);
let checkpoint: Vec3 = isVec3(stored) ? stored : DEFAULT_CHECKPOINT;

export function setCheckpoint(position: Vec3) {
    checkpoint = [...position];
    saveJson(CHECKPOINT_KEY, checkpoint);
}

export function getCheckpoint(): Vec3 {
    return checkpoint;
}
