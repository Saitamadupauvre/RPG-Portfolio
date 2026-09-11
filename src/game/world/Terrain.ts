import * as THREE from 'three';
import type { TileMap } from '../../data/tileMap';
import { createTileGrid, type TileGrid } from '../../domain/terrain/TileGrid';
import { createGroundMaterial } from './grass/groundMaterial';
import type { GrassBounds, GrassSurface } from './grass/GrassSurface';
import { rebuildTileGrid } from './terrainField';

const GRASS_DENSITY = 90;
const GRASS_CHUNK_SIZE = 4;
/**
 * Ceiling on blades held at once. Density alone is per square unit, so an area
 * this is not divided against would silently multiply the blade count. Distance
 * culling saves the draw calls, not the construction, so the cap is applied up
 * front — but only against the streamed ring below, never the whole map.
 */
const GRASS_BUDGET = 260_000;
/** Side of one streamed grass patch, in world units. */
const GRASS_PATCH_SIZE = 8;
/** How far from the player grass exists at all. Also the surface's cull distance. */
const GRASS_VIEW_RADIUS = 40;
/** Patch ring that covers that radius in every direction. */
const GRASS_PATCH_RADIUS = Math.ceil(GRASS_VIEW_RADIUS / GRASS_PATCH_SIZE);
/**
 * Area of the grown ring — a constant. Dividing the budget by this instead of
 * by the map area is the whole point: grow the map and the density does not
 * move, because the grass that exists is always the same ring around the player.
 */
const GRASS_RING_AREA = ((GRASS_PATCH_RADIUS * 2 + 1) * GRASS_PATCH_SIZE) ** 2;
const GRASS_PATCH_DENSITY = Math.min(GRASS_DENSITY, GRASS_BUDGET / GRASS_RING_AREA);
/** Grass stops growing on anything steeper than this — cliff faces stay bare rock. */
const MAX_GRASS_SLOPE = Math.cos((45 * Math.PI) / 180);

/**
 * The tiled ground.
 *
 * Built as one non-indexed mesh: two triangles per tile face, plus a vertical
 * quad wherever a seam still has a gap. Corners are not shared between tiles —
 * each tile asks `TileGrid` for its own four, and a lower tile's corners lift to
 * meet a neighbour one level up. That closes ramp seams on its own, so the only
 * walls left to build are the cliffs.
 *
 * Cliff faces need no separate material: `createGroundMaterial` already shades
 * steep surfaces as rock, and a wall is as steep as it gets.
 */
export class Terrain {
    public readonly mesh: THREE.Mesh;
    private material = createGroundMaterial();
    private grass: GrassSurface;
    private topPositions: number[] = [];
    /**
     * Sampling geometry, kept between patches: a streamed ring grows a hundred
     * patches off the same tops, and rebuilding this buffer for each one is the
     * most expensive thing in a regrow.
     */
    private topsGeometry: THREE.BufferGeometry | null = null;
    /** Grown patch keys, `${col},${row}` in patch space. */
    private grassPatches = new Set<string>();
    private lastGrassKey: string | null = null;

    constructor(map: TileMap, grass: GrassSurface) {
        this.grass = grass;
        const { geometry, topPositions } = buildGeometry(createTileGrid(map));
        this.mesh = new THREE.Mesh(geometry, this.material);
        this.topPositions = topPositions;
        this.mesh.receiveShadow = true;
        // A cliff has to drop a shadow onto the ground at its foot, or a two-level
        // wall reads as a flat painted stripe.
        this.mesh.castShadow = true;
    }

    /** Rebuilds after tile levels change: geometry, tile grid and grass all follow. */
    public rebuild(map: TileMap) {
        const grid = rebuildTileGrid(map);

        this.clearGrass();
        this.mesh.geometry.dispose();
        const { geometry, topPositions } = buildGeometry(grid);
        this.mesh.geometry = geometry;
        this.topPositions = topPositions;
    }

    /**
     * Grows and drops grass patches around [x, z]. Like the entity streamer, the
     * common frame is one compare: patches only change on a border crossing.
     */
    public updateGrass(x: number, z: number) {
        const col = Math.floor(x / GRASS_PATCH_SIZE);
        const row = Math.floor(z / GRASS_PATCH_SIZE);
        const key = `${col},${row}`;
        if (key === this.lastGrassKey) return;
        this.lastGrassKey = key;

        const wanted = new Set<string>();
        for (let r = row - GRASS_PATCH_RADIUS; r <= row + GRASS_PATCH_RADIUS; r++) {
            for (let c = col - GRASS_PATCH_RADIUS; c <= col + GRASS_PATCH_RADIUS; c++) {
                wanted.add(`${c},${r}`);
            }
        }

        for (const grown of this.grassPatches) {
            if (wanted.has(grown)) continue;

            this.grass.detach(this.mesh, grown);
            this.grassPatches.delete(grown);
        }

        for (const patch of wanted) {
            if (this.grassPatches.has(patch)) continue;

            this.growPatch(patch);
            this.grassPatches.add(patch);
        }
    }

    private clearGrass() {
        this.grass.detach(this.mesh);
        this.topsGeometry?.dispose();
        this.topsGeometry = null;
        this.grassPatches.clear();
        // Forces the next updateGrass to regrow rather than see an unchanged key.
        this.lastGrassKey = null;
    }

    private patchBounds(key: string): GrassBounds {
        const [col, row] = key.split(',').map(Number);

        return {
            minX: col * GRASS_PATCH_SIZE,
            maxX: (col + 1) * GRASS_PATCH_SIZE,
            minZ: row * GRASS_PATCH_SIZE,
            maxZ: (row + 1) * GRASS_PATCH_SIZE,
        };
    }

    private growPatch(key: string) {
        // Grass is sampled off a tops-only geometry, not the render geometry:
        // the cliff walls and their talus skirts include near-flat facets
        // (the base bulge, the mound) that would otherwise pass the slope
        // filter below and plant floating blades on the rock. Swapping the
        // geometry only for the sampling call keeps the render mesh untouched.
        if (!this.topsGeometry) {
            this.topsGeometry = new THREE.BufferGeometry();
            this.topsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(this.topPositions, 3));
        }

        const renderGeometry = this.mesh.geometry;
        this.mesh.geometry = this.topsGeometry;

        this.grass.attach(this.mesh, {
            density: GRASS_PATCH_DENSITY,
            chunkSize: GRASS_CHUNK_SIZE,
            maxDistance: GRASS_VIEW_RADIUS,
            bounds: this.patchBounds(key),
            key,
            // Rejects blades whose triangle points sideways — belt-and-braces
            // now that walls are excluded up front, and still needed for any
            // steep-but-not-cliff tile-top geometry in the future.
            acceptNormal: (normal) => (normal.y >= MAX_GRASS_SLOPE ? 1 : 0),
        });

        this.mesh.geometry = renderGeometry;
    }

    public dispose() {
        this.clearGrass();
        this.mesh.geometry.dispose();
        this.material.dispose();
    }
}

function buildGeometry(grid: TileGrid): { geometry: THREE.BufferGeometry; topPositions: number[] } {
    const { cols, rows, tileSize } = grid.map;
    const positions: number[] = [];
    const topPositions: number[] = [];

    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const x0 = grid.minX + col * tileSize;
            const z0 = grid.minZ + row * tileSize;
            const x1 = x0 + tileSize;
            const z1 = z0 + tileSize;
            const [c00, c10, c01, c11] = grid.corners(col, row);

            // Counter-clockwise seen from above, so the face points up. Reversed,
            // the ground renders from below and every surface query that reads a
            // normal — grass placement, cliff shading — sees an upside-down world.
            quad(positions, [x0, c00, z0], [x0, c01, z1], [x1, c11, z1], [x1, c10, z0]);
            quad(topPositions, [x0, c00, z0], [x0, c01, z1], [x1, c11, z1], [x1, c10, z0]);

            // Only the +X and +Z seams are walled, so each seam is built once
            // rather than twice from either side.
            wall(positions, grid, col, row, 1, 0);
            wall(positions, grid, col, row, 0, 1);
        }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    return { geometry, topPositions };
}

/** Target facet size (world units) — long/tall walls get more facets instead of stretched ones. */
const WALL_FACET_SIZE = 1.1;
/** Fraction of one sub-facet's span the interior grid points may jitter by. */
const WALL_JITTER = 0.4;
/** Extra outward push at the base (v = 1), tapering to none at the top — a wider, rooted foot. */
const WALL_BASE_BULGE = 0.5;

/**
 * Fills the seam between a tile and its neighbour with a faceted rock face.
 * Where a ramp already closed the gap the two edge heights match, the quad is
 * degenerate, and nothing is emitted.
 */
function wall(positions: number[], grid: TileGrid, col: number, row: number, dCol: number, dRow: number) {
    const other = [col + dCol, row + dRow] as const;
    if (!grid.contains(other[0], other[1])) return;

    const { tileSize } = grid.map;
    const x0 = grid.minX + col * tileSize;
    const z0 = grid.minZ + row * tileSize;

    // The two corners of this tile on the shared edge, and the matching two of
    // the neighbour. Same world positions, possibly different heights.
    const near = grid.corners(col, row);
    const far = grid.corners(other[0], other[1]);

    const [aX, aZ, bX, bZ, nearA, nearB, farA, farB] = dCol === 1
        ? [x0 + tileSize, z0, x0 + tileSize, z0 + tileSize, near[1], near[3], far[0], far[2]]
        : [x0, z0 + tileSize, x0 + tileSize, z0 + tileSize, near[2], near[3], far[0], far[1]];

    if (Math.abs(nearA - farA) < 1e-4 && Math.abs(nearB - farB) < 1e-4) return;

    // The face has to point away from the taller tile — that is the only side it
    // can be seen from. Rather than reasoning about winding per axis (+X and +Z
    // seams have opposite handedness, which is exactly how half of these ended
    // up inside-out), build one quad and flip it if its normal comes out facing
    // the wrong way.
    const outward: Point = nearA + nearB > farA + farB
        ? [dCol, 0, dRow]
        : [-dCol, 0, -dRow];

    jaggedWall(positions, [aX, aZ], [bX, bZ], nearA, nearB, farA, farB, outward);
}

/**
 * Builds the wall as a grid of small faceted quads instead of one flat one —
 * a jagged rock silhouette instead of a painted plane. Only the interior grid
 * points are pushed off the flat plane; the four corners stay pinned to the
 * tile heights so the wall still closes seams against its neighbours exactly.
 */
function jaggedWall(
    positions: number[],
    a: readonly [number, number],
    b: readonly [number, number],
    nearA: number,
    nearB: number,
    farA: number,
    farB: number,
    outward: Point,
) {
    const span = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]));
    const height = Math.max(Math.abs(nearA - farA), Math.abs(nearB - farB), 1e-4);
    const cols = Math.max(1, Math.round(span / WALL_FACET_SIZE));
    const rows = Math.max(1, Math.round(height / WALL_FACET_SIZE));
    const jitterAmount = Math.min(span / cols, height / rows) * WALL_JITTER;

    // Deterministic hash of a grid point's world position, so rebuilding the
    // terrain from the same tile levels always produces the same rock — no
    // visible "reshuffle" when an unrelated tile edit triggers a rebuild.
    const jitter = (x: number, y: number, z: number, salt: number): number => {
        const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + salt * 4.71) * 43758.5453;
        return (s - Math.floor(s)) * 2 - 1;
    };

    const point = (u: number, v: number): Point => {
        const topX = a[0] + (b[0] - a[0]) * u;
        const topZ = a[1] + (b[1] - a[1]) * u;
        const top = nearA + (nearB - nearA) * u;
        const bottom = farA + (farB - farA) * u;
        const y = top + (bottom - top) * v;
        const x = topX;
        const z = topZ;

        const interior = u > 0 && u < 1 && v > 0 && v < 1;
        if (!interior) return [x, y, z];

        // Push grows toward the base (v -> 1) so the wall reads as a rock
        // rooted in a wider foot, not just uniformly noisy. Boundary rows/cols
        // stay untouched (interior-only), so seams against neighbours and the
        // ground still close exactly.
        const basePush = 1 + v * WALL_BASE_BULGE;
        const push = jitter(x, y, z, 0) * jitterAmount * basePush;
        const lift = jitter(x, y, z, 1) * jitterAmount;
        return [
            x + outward[0] * push,
            y + lift,
            z + outward[2] * push,
        ];
    };

    for (let col = 0; col < cols; col++) {
        for (let row = 0; row < rows; row++) {
            const u0 = col / cols;
            const u1 = (col + 1) / cols;
            const v0 = row / rows;
            const v1 = (row + 1) / rows;

            const corners: [Point, Point, Point, Point] = [
                point(u0, v0),
                point(u1, v0),
                point(u1, v1),
                point(u0, v1),
            ];

            if (facesAway(corners, outward)) quad(positions, ...corners);
            else quad(positions, corners[3], corners[2], corners[1], corners[0]);
        }
    }
}

type Point = [number, number, number];

/** True when the quad's own normal already points along `outward`. */
function facesAway(corners: [Point, Point, Point, Point], outward: Point): boolean {
    const [a, b, c] = corners;
    const ab: Point = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const ac: Point = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];

    const normal: Point = [
        ab[1] * ac[2] - ab[2] * ac[1],
        ab[2] * ac[0] - ab[0] * ac[2],
        ab[0] * ac[1] - ab[1] * ac[0],
    ];

    return normal[0] * outward[0] + normal[1] * outward[1] + normal[2] * outward[2] > 0;
}

function quad(positions: number[], a: Point, b: Point, c: Point, d: Point) {
    positions.push(...a, ...b, ...c, ...a, ...c, ...d);
}
