const STORAGE_KEY = 'rpg-portfolio:bosses';

const defeated = new Set<string>(load());

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
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...defeated]));
    } catch {
    }
}

export function isBossDefeated(bossId: string): boolean {
    return defeated.has(bossId);
}

/**
 * Regular enemies come back when their chunk reloads; a boss must not. The kill
 * is recorded here rather than on the Entity, which is pooled and reused.
 */
export function defeatBoss(bossId: string) {
    defeated.add(bossId);
    save();
}

export function resetBosses() {
    defeated.clear();
    save();
}
