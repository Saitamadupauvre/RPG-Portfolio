/**
 * The one place that touches localStorage. Every read is wrapped: storage can be
 * missing (private window, blocked site data) or hold something an older build
 * wrote, and either case must fall back to a fresh default instead of throwing
 * at import time.
 */
export function loadJson(key: string): unknown {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

export function saveJson(key: string, value: unknown) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch {
        // Storage full or blocked: progress just stops persisting, the game keeps running.
    }
}

export type PersistentSet = {
    has(id: string): boolean;
    /** Returns false when the id was already there, so callers can bail early. */
    add(id: string): boolean;
    clear(): void;
};

/** A set of string ids mirrored to localStorage on every change. */
export function createPersistentSet(key: string): PersistentSet {
    const stored = loadJson(key);
    const ids = new Set<string>(
        Array.isArray(stored) ? stored.filter((id): id is string => typeof id === 'string') : [],
    );
    const save = () => saveJson(key, [...ids]);

    return {
        has: (id) => ids.has(id),
        add: (id) => {
            if (ids.has(id)) return false;
            ids.add(id);
            save();
            return true;
        },
        clear: () => {
            ids.clear();
            save();
        },
    };
}
