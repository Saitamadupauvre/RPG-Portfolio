import type { MapEntity } from '../../data/MapEntity';
import { mapLayout } from '../../data/mapLayout';

const STORAGE_KEY = 'rpg-portfolio:editor-layout';

export function loadWorkingLayout(): MapEntity[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return structuredClone(mapLayout);

        const parsed: unknown = JSON.parse(raw);

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
    }
}

export function clearWorkingLayout() {
    localStorage.removeItem(STORAGE_KEY);
}

export function downloadLayout(layout: MapEntity[]) {
    const blob = new Blob([JSON.stringify(layout, null, 4)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = 'mapLayout.json';
    link.click();

    URL.revokeObjectURL(url);
}
