import type { MapEntity } from '../../data/MapEntity';
import { mapLayout } from '../../data/mapLayout';
import { tileMap, type TileMap } from '../../data/tileMap';

const STORAGE_KEY = 'rpg-portfolio:editor-layout';
const TILES_KEY = 'rpg-portfolio:editor-tiles';

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

function serialize(layout: MapEntity[]): string {
    return JSON.stringify(layout, null, 4);
}

/** Localhost is a secure context, so the async clipboard API is always available here. */
export function copyLayout(layout: MapEntity[]): Promise<void> {
    return navigator.clipboard.writeText(serialize(layout));
}

export function sourceLayout(): MapEntity[] {
    return structuredClone(mapLayout);
}

/** Saves as `src/data/mapLayout.json`: drop the file over that one to commit the map. */
export function downloadLayout(layout: MapEntity[]) {
    downloadJson('mapLayout.json', serialize(layout));
}

/** Saves as `src/data/tileMap.json`, the terrain half of the map. */
export function downloadTiles(map: TileMap) {
    downloadJson('tileMap.json', JSON.stringify(map));
}

function downloadJson(fileName: string, text: string) {
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();

    URL.revokeObjectURL(url);
}

export function loadWorkingTiles(): TileMap {
    try {
        const raw = localStorage.getItem(TILES_KEY);
        if (!raw) return structuredClone(tileMap);

        const parsed: unknown = JSON.parse(raw);
        if (!isTileMap(parsed)) return structuredClone(tileMap);

        return parsed;
    } catch {
        return structuredClone(tileMap);
    }
}

export function saveWorkingTiles(map: TileMap) {
    try {
        localStorage.setItem(TILES_KEY, JSON.stringify(map));
    } catch {
    }
}

export function clearWorkingTiles() {
    localStorage.removeItem(TILES_KEY);
}

export function sourceTiles(): TileMap {
    return structuredClone(tileMap);
}

export function copyTiles(map: TileMap): Promise<void> {
    return navigator.clipboard.writeText(JSON.stringify(map));
}

function isTileMap(value: unknown): value is TileMap {
    if (typeof value !== 'object' || value === null) return false;

    const map = value as Partial<TileMap>;
    return (
        typeof map.cols === 'number' &&
        typeof map.rows === 'number' &&
        typeof map.tileSize === 'number' &&
        typeof map.levelHeight === 'number' &&
        Array.isArray(map.levels)
    );
}
