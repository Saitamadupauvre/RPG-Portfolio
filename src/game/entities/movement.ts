import type * as THREE from 'three';
import { isBlocked, worldToCol, worldToRow } from '../../domain/pathfinding/NavGrid';
import { getNavGrid } from '../world/navigation';

function isWorldBlocked(grid: ReturnType<typeof getNavGrid>, x: number, z: number): boolean {
    return isBlocked(grid, worldToCol(grid, x), worldToRow(grid, z));
}

export function slideMove(mesh: THREE.Object3D, direction: THREE.Vector3, distance: number) {
    const grid = getNavGrid();
    const { x, z } = mesh.position;

    const full = { x: x + direction.x * distance, z: z + direction.z * distance };
    if (!isWorldBlocked(grid, full.x, full.z)) {
        mesh.position.x = full.x;
        mesh.position.z = full.z;
        return;
    }

    if (!isWorldBlocked(grid, full.x, z)) {
        mesh.position.x = full.x;
    } else if (!isWorldBlocked(grid, x, full.z)) {
        mesh.position.z = full.z;
    }
}
