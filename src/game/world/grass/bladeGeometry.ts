import * as THREE from 'three';

const BLADE_WIDTH = 0.34;
const BLADE_CURVE = 0.11;
const SEGMENTS = 3;
const TAPER_EXPONENT = 0.7;

export const BLADE_HEIGHT = 0.34;

export function createBladeGeometry(): THREE.BufferGeometry {
    const positions: number[] = [];
    const normals: number[] = [];
    const heights: number[] = [];
    const indices: number[] = [];

    for (let i = 0; i < SEGMENTS; i++) {
        const t = i / SEGMENTS;
        const halfWidth = (BLADE_WIDTH * Math.pow(1 - t, TAPER_EXPONENT)) / 2;
        const y = BLADE_HEIGHT * t;
        const z = BLADE_CURVE * t * t;

        positions.push(-halfWidth, y, z, halfWidth, y, z);
        normals.push(0, 1, 0, 0, 1, 0);
        heights.push(t, t);
    }

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
