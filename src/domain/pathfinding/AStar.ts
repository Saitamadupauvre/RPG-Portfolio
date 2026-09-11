import { type NavGrid, canTraverse, colToWorld, rowToWorld, isBlocked, worldToCol, worldToRow } from './NavGrid';

interface Node {
    col: number;
    row: number;
    g: number;
    f: number;
    parent: Node | null;
}

/**
 * How far, in cells, a blocked goal is allowed to slide to the nearest open
 * cell. Beyond this the target is treated as genuinely unreachable.
 */
const MAX_TARGET_SLIDE = 3;

/**
 * Ceiling on nodes expanded per search. A goal walled off from the start makes
 * A* exhaust its whole reachable region before admitting failure, which on a
 * large grid is a dropped frame. Giving up early costs nothing: the caller
 * already handles a null path.
 */
const MAX_EXPANSIONS = 2000;

const NEIGHBORS = [
    [1, 0], [-1, 0], [0, 1], [0, -1],
    [1, 1], [1, -1], [-1, 1], [-1, -1],
];

export function findPath(grid: NavGrid, start: [number, number], end: [number, number]): [number, number][] | null {
    const startCol = worldToCol(grid, start[0]);
    const startRow = worldToRow(grid, start[1]);
    const rawEndCol = worldToCol(grid, end[0]);
    const rawEndRow = worldToRow(grid, end[1]);

    const target = findWalkableTarget(grid, rawEndCol, rawEndRow);
    if (!target) return null;
    const [endCol, endRow] = target;

    const key = (col: number, row: number) => row * grid.cols + col;
    const open = new Map<number, Node>();
    const closed = new Set<number>();

    const startNode: Node = { col: startCol, row: startRow, g: 0, f: heuristic(startCol, startRow, endCol, endRow), parent: null };
    open.set(key(startCol, startRow), startNode);

    let expansions = 0;

    while (open.size > 0) {
        if (++expansions > MAX_EXPANSIONS) return null;

        const current = lowestF(open);
        if (current.col === endCol && current.row === endRow) return reconstruct(grid, current);

        open.delete(key(current.col, current.row));
        closed.add(key(current.col, current.row));

        for (const [dc, dr] of NEIGHBORS) {
            const col = current.col + dc;
            const row = current.row + dr;
            if (!canTraverse(grid, current.col, current.row, col, row)) continue;
            if (closed.has(key(col, row))) continue;

            // A diagonal may not cut a corner: both orthogonal steps that make it
            // up have to be walkable too, or a path slips through a cliff seam.
            if (dc !== 0 && dr !== 0 && (
                !canTraverse(grid, current.col, current.row, current.col + dc, current.row) ||
                !canTraverse(grid, current.col, current.row, current.col, current.row + dr)
            )) continue;

            const stepCost = dc !== 0 && dr !== 0 ? Math.SQRT2 : 1;
            const g = current.g + stepCost;
            const existing = open.get(key(col, row));

            if (!existing || g < existing.g) {
                open.set(key(col, row), { col, row, g, f: g + heuristic(col, row, endCol, endRow), parent: current });
            }
        }
    }

    return null;
}

function findWalkableTarget(grid: NavGrid, targetCol: number, targetRow: number): [number, number] | null {
    if (!isBlocked(grid, targetCol, targetRow)) return [targetCol, targetRow];

    // Breadth-first over the blocked cells around the goal, so the cell we
    // settle on is the genuinely nearest open one. Probing only the eight
    // compass directions at each radius (the obvious shortcut) samples 8 cells
    // of a ring that holds 8 * radius, and its diagonal probes jump clean over
    // a wall instead of walking around it.
    const seen = new Set<number>([targetRow * grid.cols + targetCol]);
    let frontier: [number, number][] = [[targetCol, targetRow]];

    for (let radius = 1; radius <= MAX_TARGET_SLIDE; radius++) {
        const next: [number, number][] = [];

        for (const [col, row] of frontier) {
            for (const [dc, dr] of NEIGHBORS) {
                const c = col + dc;
                const r = row + dr;
                if (c < 0 || c >= grid.cols || r < 0 || r >= grid.rows) continue;

                const cellKey = r * grid.cols + c;
                if (seen.has(cellKey)) continue;
                seen.add(cellKey);

                if (!isBlocked(grid, c, r)) return [c, r];
                next.push([c, r]);
            }
        }

        frontier = next;
    }

    return null;
}

function heuristic(col: number, row: number, endCol: number, endRow: number): number {
    return Math.hypot(endCol - col, endRow - row);
}

function lowestF(open: Map<number, Node>): Node {
    let best: Node | null = null;
    for (const node of open.values()) {
        if (!best || node.f < best.f) best = node;
    }
    return best as Node;
}

function reconstruct(grid: NavGrid, end: Node): [number, number][] {
    const path: [number, number][] = [];
    let node: Node | null = end;
    while (node) {
        path.push([colToWorld(grid, node.col), rowToWorld(grid, node.row)]);
        node = node.parent;
    }
    return path.reverse();
}
