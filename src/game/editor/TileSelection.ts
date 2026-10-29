import * as THREE from 'three';
import type { TileMap } from '../../data/tileMap';
import type { TileGrid } from '../../domain/terrain/TileGrid';

const HIGHLIGHT_COLOR = 0x3ae6c9;
/** Lifts the highlight off the tile it marks, so the two never z-fight. */
const HOVER = 0.02;

/**
 * The set of tiles being edited, plus the object the gizmo actually grabs.
 *
 * Tiles are not scene objects — the ground is one merged mesh — so a selection
 * needs a stand-in: an empty `proxy` parked at the selection's centre that the
 * gizmo moves, whose travel is read back as a whole number of levels. That is
 * what lets a tile be dragged like any other entity without giving every tile
 * its own mesh.
 */
export class TileSelection {
    public readonly proxy = new THREE.Object3D();
    private scene: THREE.Object3D;
    /**
     * One instanced draw for the whole selection. A brush stroke re-highlights
     * hundreds of tiles per mouse move, and a Mesh per tile meant hundreds of
     * new scene objects each time.
     */
    private highlight: THREE.InstancedMesh | null = null;
    private selected = new Set<number>();
    private geometry = new THREE.PlaneGeometry(1, 1);
    private material = new THREE.MeshBasicMaterial({
        color: HIGHLIGHT_COLOR,
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
        side: THREE.DoubleSide,
    });

    constructor(scene: THREE.Object3D) {
        this.scene = scene;
        this.geometry.rotateX(-Math.PI / 2);
        scene.add(this.proxy);
    }

    public get size(): number {
        return this.selected.size;
    }

    public get indices(): number[] {
        return [...this.selected];
    }

    public isEmpty(): boolean {
        return this.selected.size === 0;
    }

    public clear() {
        this.selected.clear();
        this.refresh(null);
    }

    /** Adds a tile, or replaces the selection with it when not extending. */
    public toggle(index: number, extend: boolean, grid: TileGrid) {
        if (!extend) {
            const alreadyOnlyThis = this.selected.size === 1 && this.selected.has(index);
            this.selected.clear();
            if (alreadyOnlyThis) {
                this.refresh(grid);
                return;
            }
        }

        if (extend && this.selected.has(index)) {
            this.selected.delete(index);
        } else {
            this.selected.add(index);
        }

        this.refresh(grid);
    }

    /** Bulk edit for the box and the brush: 'replace' swaps the selection for these tiles. */
    public apply(indices: Iterable<number>, mode: 'replace' | 'add' | 'remove', grid: TileGrid) {
        if (mode === 'replace') this.selected.clear();

        for (const index of indices) {
            if (mode === 'remove') this.selected.delete(index);
            else this.selected.add(index);
        }

        this.refresh(grid);
    }

    /** The level shared by every selected tile, or null when they differ. */
    public commonLevel(map: TileMap): number | null {
        let level: number | null = null;

        for (const index of this.selected) {
            const tileLevel = map.levels[index] ?? 0;
            if (level === null) level = tileLevel;
            else if (level !== tileLevel) return null;
        }

        return level;
    }

    /** Repositions the proxy and the highlight quads over the current tiles. */
    public refresh(grid: TileGrid | null) {
        if (!grid || this.selected.size === 0) {
            if (this.highlight) this.highlight.count = 0;
            return;
        }

        const { cols, tileSize } = grid.map;
        const highlight = this.ensureCapacity(grid.map.cols * grid.map.rows);
        const center = new THREE.Vector3();
        const matrix = new THREE.Matrix4();
        const position = new THREE.Vector3();
        const scale = new THREE.Vector3(tileSize, 1, tileSize);
        const rotation = new THREE.Quaternion();

        let slot = 0;
        for (const index of this.selected) {
            const col = index % cols;
            const row = Math.floor(index / cols);
            const y = grid.levelAt(col, row) * grid.map.levelHeight;

            position.set(grid.tileCenterX(col), y + HOVER, grid.tileCenterZ(row));
            highlight.setMatrixAt(slot++, matrix.compose(position, rotation, scale));
            center.add(position);
        }

        highlight.count = slot;
        highlight.instanceMatrix.needsUpdate = true;
        this.proxy.position.copy(center.divideScalar(this.selected.size));
    }

    /** Sized for every tile of the grid, and only rebuilt when the grid grows. */
    private ensureCapacity(capacity: number): THREE.InstancedMesh {
        if (this.highlight && this.highlight.instanceMatrix.count >= capacity) return this.highlight;

        this.disposeHighlight();
        const highlight = new THREE.InstancedMesh(this.geometry, this.material, capacity);
        // The instances move every refresh; a cached bounding sphere would go
        // stale and cull the highlight while it is still on screen.
        highlight.frustumCulled = false;
        this.scene.add(highlight);
        this.highlight = highlight;
        return highlight;
    }

    /** Frees only the instance buffers: the geometry and material outlive every resize. */
    private disposeHighlight() {
        if (!this.highlight) return;
        this.highlight.removeFromParent();
        this.highlight.dispose();
        this.highlight = null;
    }

    public dispose() {
        this.disposeHighlight();
        this.geometry.dispose();
        this.material.dispose();
    }
}
