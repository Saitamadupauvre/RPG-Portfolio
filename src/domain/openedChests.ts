import { createPersistentSet } from './persistence';

const opened = createPersistentSet('rpg-portfolio:chests');

export function isChestOpened(chestId: string): boolean {
    return opened.has(chestId);
}

/** Returns false when the chest was already looted, so callers can bail early. */
export function openChest(chestId: string): boolean {
    return opened.add(chestId);
}

export function resetChests() {
    opened.clear();
}
