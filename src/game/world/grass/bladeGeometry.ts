import * as THREE from 'three';

const BLADE_WIDTH = 0.105;
const BLADE_HEIGHT = 0.34;
/** How far the blade arcs forward on its way to the tip. */
const BLADE_CURVE = 0.11;
/** Rings between root and apex. 3 is enough to read as a curve at this scale. */
const SEGMENTS = 3;

/**
 * A single tapered, forward-curving blade ending in a point.
 *
 * Two deliberate choices, both aimed at the soft painted look:
 *
 * - One quad strip, not the crossed quads of the old Grass.ts. Crossed quads
 *   buy volume, which is exactly what a flat illustrated blade should not have,
 *   and they double the triangle count at a density where that matters.
 * - Normals point straight up, not out of the quad face. Real quad normals make
 *   each blade catch the sun on one side and go black on the other, which reads
 *   as harsh 3D scatter. Up-facing normals make blades shade like the ground
 *   they stand on, so the whole field lights as one soft surface.
 *
 * `aHeight` (0 at the root, 1 at the tip) is the bend and gradient weight.
 */
export function createBladeGeometry(): THREE.BufferGeometry {
    const positions: number[] = [];
    const normals: number[] = [];
    const heights: number[] = [];
    const indices: number[] = [];

    for (let i = 0; i < SEGMENTS; i++) {
        const t = i / SEGMENTS;
        // pow(1 - t, 0.7) keeps the blade broad low down and narrows it late,
        // rather than the straight-sided wedge a linear taper would give.
        const halfWidth = (BLADE_WIDTH * Math.pow(1 - t, 0.7)) / 2;
        const y = BLADE_HEIGHT * t;
        const z = BLADE_CURVE * t * t;

        positions.push(-halfWidth, y, z, halfWidth, y, z);
        normals.push(0, 1, 0, 0, 1, 0);
        heights.push(t, t);
    }

    // Apex: a single vertex, so the blade ends in a real point.
    positions.push(0, BLADE_HEIGHT, BLADE_CURVE);
    normals.push(0, 1, 0);
    heights.push(1);

    for (let i = 0; i < SEGMENTS - 1; i++) {
        const a = i * 2;
        indices.push(a, a + 1, a + 3, a, a + 3, a + 2);
    }

    const lastRing = (SEGMENTS - 1) * 2;
    const apex = SEGMENTS * 2;
    indices.push(lastRing, lastRing + 1, apex);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute('aHeight', new THREE.Float32BufferAttribute(heights, 1));
    geometry.setIndex(indices);

    return geometry;
}

export { BLADE_HEIGHT };
