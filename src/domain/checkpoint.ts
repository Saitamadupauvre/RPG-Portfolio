import type { Vec3 } from '../data/MapEntity';

const CHECKPOINT_KEY = 'rpg-portfolio:checkpoint';

const DEFAULT_CHECKPOINT: Vec3 = [0, 0, 0];

let checkpoint: Vec3 = load();

function isVec3(value: unknown): value is Vec3 {
    return Array.isArray(value)
        && value.length === 3
        && value.every((component) => typeof component === 'number');
}

function load(): Vec3 {
    try {
        const raw = localStorage.getItem(CHECKPOINT_KEY);
        const parsed: unknown = raw ? JSON.parse(raw) : null;
        return isVec3(parsed) ? parsed : DEFAULT_CHECKPOINT;
    } catch {
        return DEFAULT_CHECKPOINT;
    }
}

function save() {
    try {
        localStorage.setItem(CHECKPOINT_KEY, JSON.stringify(checkpoint));
    } catch {
    }
}

export function setCheckpoint(position: Vec3) {
    checkpoint = [...position];
    save();
}

export function getCheckpoint(): Vec3 {
    return checkpoint;
}
