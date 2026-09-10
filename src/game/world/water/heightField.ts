import * as THREE from 'three';
import { getTileGrid } from '../terrainField';

/**
 * The terrain heightfield, as a texture the water shader can sample.
 *
 * Used only for the vertex stage now — damping the swell to calm water near a
 * bank. The shore edge, foam and depth colour read the real rendered scene
 * instead (`depthPrepass.ts`), since a CPU-built heightfield can only describe
 * one height per XZ and drifts out of step with an actual cliff, overhang, or
 * anything else standing in the water.
 *
 * Sampled at tile *corners*, not tile centres: `(cols + 1) x (rows + 1)` texels.
 * That is the resolution the terrain mesh itself is built at, so bilinear
 * filtering between corners reproduces exactly the surface `TileGrid.heightAt`
 * walks on — and the coastline lands on the real cliff edge instead of being
 * smeared half a tile inland, which is what a centre-sampled field does.
 */
let texture: THREE.DataTexture | null = null;

export function getHeightTexture(): THREE.DataTexture {
    if (!texture) texture = build();
    return texture;
}

/** Re-uploads after a sculpt, reallocating only when the grid changed size. */
export function rebuildHeightTexture(): THREE.DataTexture {
    const { cols, rows } = getTileGrid().map;

    if (texture && texture.image.width === cols + 1 && texture.image.height === rows + 1) {
        fill(texture.image.data as Uint16Array);
        texture.needsUpdate = true;
        return texture;
    }

    texture?.dispose();
    texture = build();
    return texture;
}

/** What the shader needs to turn a world XZ into a texture UV. */
export function heightFieldBounds(): {
    origin: THREE.Vector2;
    tileSize: number;
    tiles: THREE.Vector2;
} {
    const grid = getTileGrid();
    const { cols, rows, tileSize } = grid.map;

    return {
        origin: new THREE.Vector2(grid.minX, grid.minZ),
        tileSize,
        tiles: new THREE.Vector2(cols, rows),
    };
}

function build(): THREE.DataTexture {
    const { cols, rows } = getTileGrid().map;
    const data = new Uint16Array((cols + 1) * (rows + 1));
    fill(data);

    // Half floats rather than full: heights are small numbers, and this halves a
    // texture that gets re-uploaded on every editor drag.
    const created = new THREE.DataTexture(data, cols + 1, rows + 1, THREE.RedFormat, THREE.HalfFloatType);
    created.minFilter = THREE.LinearFilter;
    created.magFilter = THREE.LinearFilter;
    created.wrapS = THREE.ClampToEdgeWrapping;
    created.wrapT = THREE.ClampToEdgeWrapping;
    created.generateMipmaps = false;
    created.needsUpdate = true;

    return created;
}

/**
 * A corner is shared by up to four tiles, and a ramp can lift one tile's copy of
 * it without lifting its neighbour's. Taking the highest is what keeps the sea
 * out of the rock: the coastline then sits at the top of a cliff face rather
 * than eating into its foot.
 */
function fill(data: Uint16Array) {
    const grid = getTileGrid();
    const { cols, rows } = grid.map;
    const stride = cols + 1;

    for (let corner = 0; corner <= rows; corner++) {
        for (let side = 0; side <= cols; side++) {
            let height = -Infinity;

            // The four tiles meeting at this corner, and which of their own four
            // corners is the shared one. TileCorners order is -X-Z, +X-Z, -X+Z, +X+Z.
            for (const [dCol, dRow, index] of TOUCHING) {
                const col = side + dCol;
                const row = corner + dRow;
                if (!grid.contains(col, row)) continue;
                height = Math.max(height, grid.corners(col, row)[index]);
            }

            data[corner * stride + side] = THREE.DataUtils.toHalfFloat(
                height === -Infinity ? 0 : height,
            );
        }
    }
}

const TOUCHING = [
    [-1, -1, 3],
    [0, -1, 2],
    [-1, 0, 1],
    [0, 0, 0],
] as const;
