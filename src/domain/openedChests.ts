const STORAGE_KEY = 'rpg-portfolio:chests';

const opened = new Set<string>(load());

function load(): string[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const parsed: unknown = raw ? JSON.parse(raw) : null;
        return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
    } catch {
        return [];
    }
}

function save() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...opened]));
    } catch {
    }
}

export function isChestOpened(chestId: string): boolean {
    return opened.has(chestId);
}

/** Returns false when the chest was already looted, so callers can bail early. */
export function openChest(chestId: string): boolean {
    if (opened.has(chestId)) return false;

    opened.add(chestId);
    save();
    return true;
}

export function resetChests() {
    opened.clear();
    save();
}
