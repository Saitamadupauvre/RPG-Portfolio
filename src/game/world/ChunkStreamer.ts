import type { MapEntity } from '../../data/MapEntity';
import { bucketByChunk, chunkKeyAt, keysInRadius, type ChunkKey } from '../../domain/chunks';

/** Chunks kept alive around the player's own chunk, as a square ring radius. */
const LOAD_RADIUS = 2;

/**
 * Decides *which* chunks should exist; the caller decides what spawning one
 * means. Keeping the Three.js side in callbacks is what lets this stay pure
 * bookkeeping — a Map, a Set, and a diff.
 */
export class ChunkStreamer {
    private buckets = new Map<ChunkKey, MapEntity[]>();
    private loaded = new Set<ChunkKey>();
    private lastKey: ChunkKey | null = null;

    private spawn: (entity: MapEntity, key: ChunkKey) => void;
    private despawn: (key: ChunkKey) => void;

    constructor(
        spawn: (entity: MapEntity, key: ChunkKey) => void,
        despawn: (key: ChunkKey) => void,
    ) {
        this.spawn = spawn;
        this.despawn = despawn;
    }

    public setLayout(layout: MapEntity[]) {
        this.clear();
        this.buckets = bucketByChunk(layout);
    }

    /** Forgets what is loaded without despawning; the caller owns the teardown. */
    public clear() {
        this.loaded.clear();
        this.lastKey = null;
    }

    /** Returns true when the loaded set changed, so the caller can refresh caches. */
    public update(x: number, z: number): boolean {
        const key = chunkKeyAt(x, z);
        // The common frame is one floor pair and a string compare: chunk borders
        // are crossed a few times a minute, not sixty times a second.
        if (key === this.lastKey) return false;
        this.lastKey = key;

        const wanted = new Set(keysInRadius(x, z, LOAD_RADIUS));

        for (const loadedKey of this.loaded) {
            if (wanted.has(loadedKey)) continue;

            this.despawn(loadedKey);
            this.loaded.delete(loadedKey);
        }

        for (const wantedKey of wanted) {
            if (this.loaded.has(wantedKey)) continue;
            this.loaded.add(wantedKey);

            for (const mapEntity of this.buckets.get(wantedKey) ?? []) {
                this.spawn(mapEntity, wantedKey);
            }
        }

        return true;
    }
}
