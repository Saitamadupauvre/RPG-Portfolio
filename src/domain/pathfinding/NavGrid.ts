export interface NavObstacle {
    // Center position and XZ footprint, both in world units.
    position: [number, number];
    size: [number, number];
}

export interface NavGridBounds {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
}

export interface NavGrid {
    bounds: NavGridBounds;
    cellSize: number;
    cols: number;
    rows: number;
    blocked: boolean[];
}

export function buildNavGrid(obstacles: NavObstacle[], bounds: NavGridBounds, cellSize: number): NavGrid {
    const cols = Math.ceil((bounds.maxX - bounds.minX) / cellSize);
    const rows = Math.ceil((bounds.maxZ - bounds.minZ) / cellSize);
    const blocked = new Array<boolean>(cols * rows).fill(false);

    const grid: NavGrid = { bounds, cellSize, cols, rows, blocked };

    for (const obstacle of obstacles) {
        const [cx, cz] = obstacle.position;
        const [w, d] = obstacle.size;
        const minCol = worldToCol(grid, cx - w / 2);
        const maxCol = worldToCol(grid, cx + w / 2);
        const minRow = worldToRow(grid, cz - d / 2);
        const maxRow = worldToRow(grid, cz + d / 2);

        for (let row = minRow; row <= maxRow; row++) {
            for (let col = minCol; col <= maxCol; col++) {
                setBlocked(grid, col, row);
            }
        }
    }

    return grid;
}

export function worldToCol(grid: NavGrid, x: number): number {
    return clamp(Math.floor((x - grid.bounds.minX) / grid.cellSize), 0, grid.cols - 1);
}

export function worldToRow(grid: NavGrid, z: number): number {
    return clamp(Math.floor((z - grid.bounds.minZ) / grid.cellSize), 0, grid.rows - 1);
}

export function colToWorld(grid: NavGrid, col: number): number {
    return grid.bounds.minX + (col + 0.5) * grid.cellSize;
}

export function rowToWorld(grid: NavGrid, row: number): number {
    return grid.bounds.minZ + (row + 0.5) * grid.cellSize;
}

export function isBlocked(grid: NavGrid, col: number, row: number): boolean {
    if (col < 0 || col >= grid.cols || row < 0 || row >= grid.rows) return true;
    return grid.blocked[row * grid.cols + col];
}

function setBlocked(grid: NavGrid, col: number, row: number) {
    if (col < 0 || col >= grid.cols || row < 0 || row >= grid.rows) return;
    grid.blocked[row * grid.cols + col] = true;
}

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}
