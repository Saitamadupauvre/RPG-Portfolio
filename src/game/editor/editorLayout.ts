import type { MapEntity } from '../../data/MapEntity';
import { mapLayout } from '../../data/mapLayout';

const STORAGE_KEY = 'rpg-portfolio:editor-layout';

// The editor's working copy of the level. Kept separate from `mapLayout` (which stays the
// committed source of truth) and autosaved, so a browser reload mid-session doesn't throw
// away an hour of placement work.
export function loadWorkingLayout(): MapEntity[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return structuredClone(mapLayout);

        const parsed: unknown = JSON.parse(raw);
        // Shallow validation only: this is dev-only data written by this same editor.
        if (!Array.isArray(parsed) || parsed.some((e) => typeof e?.kind !== 'string')) {
            return structuredClone(mapLayout);
        }
        return parsed as MapEntity[];
    } catch {
        return structuredClone(mapLayout);
    }
}

export function saveWorkingLayout(layout: MapEntity[]) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
    } catch {
        // Autosave is a convenience; never interrupt editing over it.
    }
}

export function clearWorkingLayout() {
    localStorage.removeItem(STORAGE_KEY);
}

// Hands the layout to the user as a file to commit as src/data/mapLayout.json.
export function downloadLayout(layout: MapEntity[]) {
    const blob = new Blob([JSON.stringify(layout, null, 4)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = 'mapLayout.json';
    link.click();

    // Revoking frees the blob; without it the data stays alive for the page's lifetime.
    URL.revokeObjectURL(url);
}
