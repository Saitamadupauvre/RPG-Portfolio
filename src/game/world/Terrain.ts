import * as THREE from 'three';
import type { TileMap } from '../../data/tileMap';
import { createTileGrid, type TileGrid } from '../../domain/terrain/TileGrid';
import { createGroundMaterial } from './grass/groundMaterial';
import type { GrassSurface } from './grass/GrassSurface';
import { getTileGrid, rebuildTileGrid } from './terrainField';

const GRASS_DENSITY = 90;
const GRASS_CHUNK_SIZE = 4;
/**
 * Ceiling on total blades. Density alone is per square unit, so a bigger map
 * would silently multiply the blade count — a 120-unit grid at full density is
 * over a million instances to build and keep in memory. Distance culling saves
 * the draw calls, not the construction, so the cap has to be applied up front.
 */
const GRASS_BUDGET = 260_000;
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

    constructor(map: TileMap, grass: GrassSurface) {
        this.grass = grass;
        this.mesh = new THREE.Mesh(buildGeometry(createTileGrid(map)), this.material);
        this.mesh.receiveShadow = true;
        // A cliff has to drop a shadow onto the ground at its foot, or a two-level
        // wall reads as a flat painted stripe.
        this.mesh.castShadow = true;

        this.growGrass();
    }

    /** Rebuilds after tile levels change: geometry, tile grid and grass all follow. */
    public rebuild(map: TileMap) {
        const grid = rebuildTileGrid(map);

        this.grass.detach(this.mesh);
        this.mesh.geometry.dispose();
        this.mesh.geometry = buildGeometry(grid);
        this.growGrass();
    }

    private growGrass() {
        const grid = getTileGrid();
        const area = grid.map.cols * grid.map.rows * grid.map.tileSize ** 2;

        this.grass.attach(this.mesh, {
            density: Math.min(GRASS_DENSITY, GRASS_BUDGET / area),
            chunkSize: GRASS_CHUNK_SIZE,
            // Rejects blades whose triangle points sideways, which is exactly the
            // set of wall triangles. Cheaper and more robust than tagging them.
            acceptNormal: (normal) => (normal.y >= MAX_GRASS_SLOPE ? 1 : 0),
        });
    }

    public dispose() {
        this.grass.detach(this.mesh);
        this.mesh.geometry.dispose();
        this.material.dispose();
    }
}

function buildGeometry(grid: TileGrid): THREE.BufferGeometry {
    const { cols, rows, tileSize } = grid.map;
    const positions: number[] = [];

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
    return geometry;
}

/**
 * Fills the seam between a tile and its neighbour with a vertical face. Where a
 * ramp already closed the gap the two edge heights match, the quad is
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

    const corners: [Point, Point, Point, Point] = [
        [aX, nearA, aZ],
        [bX, nearB, bZ],
        [bX, farB, bZ],
        [aX, farA, aZ],
    ];

    if (facesAway(corners, outward)) quad(positions, ...corners);
    else quad(positions, corners[3], corners[2], corners[1], corners[0]);
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
