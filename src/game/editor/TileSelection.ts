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
    private highlight = new THREE.Group();
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
        this.geometry.rotateX(-Math.PI / 2);
        scene.add(this.highlight);
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
        // Just detach: every quad shares this instance's single geometry and
        // material, so disposing here would destroy them for the next refresh.
        this.highlight.clear();

        if (!grid || this.selected.size === 0) return;

        const { cols, tileSize } = grid.map;
        const center = new THREE.Vector3();

        for (const index of this.selected) {
            const col = index % cols;
            const row = Math.floor(index / cols);
            const x = grid.tileCenterX(col);
            const z = grid.tileCenterZ(row);
            const y = grid.levelAt(col, row) * grid.map.levelHeight;

            const quad = new THREE.Mesh(this.geometry, this.material);
            quad.scale.set(tileSize, 1, tileSize);
            quad.position.set(x, y + HOVER, z);
            this.highlight.add(quad);

            center.add(quad.position);
        }

        this.proxy.position.copy(center.divideScalar(this.selected.size));
    }

    public dispose() {
        this.highlight.clear();
        this.geometry.dispose();
        this.material.dispose();
    }
}
