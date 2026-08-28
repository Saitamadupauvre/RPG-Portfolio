import { type NavGrid, colToWorld, rowToWorld, isBlocked, worldToCol, worldToRow } from './NavGrid';

interface Node {
    col: number;
    row: number;
    g: number;
    f: number;
    parent: Node | null;
}

const NEIGHBORS = [
    [1, 0], [-1, 0], [0, 1], [0, -1],
    [1, 1], [1, -1], [-1, 1], [-1, -1],
];

export function findPath(grid: NavGrid, start: [number, number], end: [number, number]): [number, number][] | null {
    const startCol = worldToCol(grid, start[0]);
    const startRow = worldToRow(grid, start[1]);
    const endCol = worldToCol(grid, end[0]);
    const endRow = worldToRow(grid, end[1]);

    if (isBlocked(grid, endCol, endRow)) return null;

    const key = (col: number, row: number) => row * grid.cols + col;
    const open = new Map<number, Node>();
    const closed = new Set<number>();

    const startNode: Node = { col: startCol, row: startRow, g: 0, f: heuristic(startCol, startRow, endCol, endRow), parent: null };
    open.set(key(startCol, startRow), startNode);

    while (open.size > 0) {
        const current = lowestF(open);
        if (current.col === endCol && current.row === endRow) return reconstruct(grid, current);

        open.delete(key(current.col, current.row));
        closed.add(key(current.col, current.row));

        for (const [dc, dr] of NEIGHBORS) {
            const col = current.col + dc;
            const row = current.row + dr;
            if (isBlocked(grid, col, row)) continue;
            if (closed.has(key(col, row))) continue;

            if (dc !== 0 && dr !== 0 && (isBlocked(grid, current.col + dc, current.row) || isBlocked(grid, current.col, current.row + dr))) continue;

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
        path.unshift([colToWorld(grid, node.col), rowToWorld(grid, node.row)]);
        node = node.parent;
    }
    return path;
}
