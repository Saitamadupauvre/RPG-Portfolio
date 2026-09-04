import type * as THREE from 'three';
import { canTraverse, isBlocked, worldToCol, worldToRow } from '../../domain/pathfinding/NavGrid';
import { getNavGrid } from '../world/navigation';

type Grid = ReturnType<typeof getNavGrid>;

function isWorldBlocked(grid: Grid, x: number, z: number): boolean {
    return isBlocked(grid, worldToCol(grid, x), worldToRow(grid, z));
}

/** Blocked destination, or a step too tall to climb — a cliff stops both. */
function cannotReach(grid: Grid, fromX: number, fromZ: number, toX: number, toZ: number): boolean {
    return !canTraverse(
        grid,
        worldToCol(grid, fromX),
        worldToRow(grid, fromZ),
        worldToCol(grid, toX),
        worldToRow(grid, toZ),
    );
}

export function slideMove(mesh: THREE.Object3D, direction: THREE.Vector3, distance: number) {
    const grid = getNavGrid();
    const { x, z } = mesh.position;

    // Standing inside a blocked cell (respawn on a landmark, an obstacle added
    // by the editor) would fail every test below and pin the player forever.
    // Let them walk out instead.
    if (isWorldBlocked(grid, x, z)) {
        mesh.position.x += direction.x * distance;
        mesh.position.z += direction.z * distance;
        return;
    }

    const full = { x: x + direction.x * distance, z: z + direction.z * distance };
    if (!cannotReach(grid, x, z, full.x, full.z)) {
        mesh.position.x = full.x;
        mesh.position.z = full.z;
        return;
    }

    // Blocked head-on: keep whichever single axis still works, so the walker
    // slides along the wall or cliff face instead of sticking to it.
    if (!cannotReach(grid, x, z, full.x, z)) {
        mesh.position.x = full.x;
    } else if (!cannotReach(grid, x, z, x, full.z)) {
        mesh.position.z = full.z;
    }
}
