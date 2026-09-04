import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { events } from '../../core/events';
import { stateMachine } from '../../core/StateMachine';
import type { MapEntity } from '../../data/MapEntity';
import { readTransform } from '../entities/applyTransform';
import type { Experience } from '../Experience';
import {
    clearWorkingLayout,
    clearWorkingTiles,
    copyLayout,
    copyTiles,
    downloadLayout,
    loadWorkingLayout,
    loadWorkingTiles,
    saveWorkingLayout,
    saveWorkingTiles,
    sourceLayout,
    sourceTiles,
} from './editorLayout';
import { getTileGrid, rebuildTileGrid } from '../world/terrainField';
import { resizeTileMap, type TileMap } from '../../data/tileMap';
import { TileSelection } from './TileSelection';
import { createDefaultEntity, uniqueId } from './entityDefaults';

const GRID_SNAP = 1;
const ROTATION_SNAP = Math.PI / 12;

export class EditorSystem {
    private experience: Experience;
    private orbit: OrbitControls;
    private gizmo: TransformControls;
    private raycaster = new THREE.Raycaster();
    private pointer = new THREE.Vector2();
    private grid: THREE.GridHelper;

    private layout: MapEntity[] = loadWorkingLayout();
    private tiles: TileMap = loadWorkingTiles();
    private tileSelection: TileSelection;
    private tileMode = false;
    /** Proxy height when the current gizmo drag started, to measure travel from. */
    private dragBaseY = 0;
    private selectedId: string | null = null;
    private placeKind: MapEntity['kind'] | null = null;
    private placeVariant = '';
    /** Held Shift bypasses snapping, both for the gizmo and for click placement. */
    private shift = false;

    constructor(experience: Experience) {
        this.experience = experience;
        const { camera, canvas, scene } = this.experience;

        this.orbit = new OrbitControls(camera, canvas);
        this.orbit.enabled = false;

        this.gizmo = new TransformControls(camera, canvas);
        this.gizmo.setTranslationSnap(GRID_SNAP);
        this.gizmo.setRotationSnap(ROTATION_SNAP);

        scene.add(this.gizmo.getHelper());

        this.grid = buildGridHelper(this.tiles);
        this.grid.visible = false;
        scene.add(this.grid);

        this.gizmo.addEventListener('dragging-changed', (event) => {
            this.orbit.enabled = !event.value;
        });

        this.gizmo.addEventListener('objectChange', () => {
            if (this.tileMode) this.dragTiles();
            else this.commitTransform();
        });

        canvas.addEventListener('pointerdown', (event) => this.onPointerDown(event));
        window.addEventListener('keydown', (event) => this.onKeyDown(event));
        window.addEventListener('keyup', (event) => {
            if (event.key === 'Shift') this.setShift(false);
        });
        // Alt-tabbing away with Shift down would otherwise leave snapping off forever.
        window.addEventListener('blur', () => this.setShift(false));

        events.on('editorPlaceKindChanged', (kind, variant) => {
            this.placeKind = kind;
            this.placeVariant = variant;
            this.select(null);
        });
        events.on('editorGizmoChanged', (mode) => this.gizmo.setMode(mode));
        events.on('editorExportRequested', () => downloadLayout(this.layout));
        events.on('editorCopyRequested', () => copyLayout(this.layout));
        events.on('editorResetRequested', () => this.resetToSource());
        events.on('editorEntityEdited', (edited) => this.applyEdit(edited));
        events.on('editorTerrainCopyRequested', () => copyTiles(this.tiles));
        events.on('editorTileModeChanged', (enabled) => this.setTileMode(enabled));
        events.on('editorTileGridResized', (cols, rows) => {
            this.tiles = resizeTileMap(this.tiles, cols, rows);
            this.tileSelection.clear();
            this.rebuildTerrain();
        });

        this.tileSelection = new TileSelection(scene);
        rebuildTileGrid(this.tiles);
        this.experience.world.terrain.rebuild(this.tiles);
        this.experience.world.loadLayout(this.layout);
    }

    public enter() {
        const { camera } = this.experience;
        this.orbit.target.copy(this.experience.world.player.mesh.position);
        this.orbit.enabled = true;
        this.orbit.update();

        this.grid.visible = true;
        camera.updateMatrixWorld();
        events.emit('editorLayoutChanged', this.layout.length);
    }

    public exit() {
        this.select(null);
        this.orbit.enabled = false;
        this.grid.visible = false;
        this.experience.world.resetCamera();
    }

    public update() {
        if (stateMachine.getState() !== 'EDITOR') return;
        this.orbit.update();
    }

    private onPointerDown(event: PointerEvent) {
        if (stateMachine.getState() !== 'EDITOR' || event.button !== 0) return;

        if (this.gizmo.dragging) return;

        this.pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
        this.raycaster.setFromCamera(this.pointer, this.experience.camera);

        if (this.tileMode) {
            this.pickTile(event.shiftKey);
            return;
        }

        if (this.placeKind) {
            this.placeAtCursor();
            return;
        }

        this.select(this.pickEntityId());
    }

    /**
     * Tiles are picked by where the ray lands on the ground, not by hitting a
     * per-tile object: the floor is one merged mesh, so the hit point is
     * converted back into a column and row.
     */
    private pickTile(extend: boolean) {
        const point = this.pickTerrainPoint();
        if (!point) return;

        const grid = getTileGrid();
        this.tileSelection.toggle(grid.index(grid.colAt(point.x), grid.rowAt(point.z)), extend, grid);
        this.attachTileGizmo();
    }

    private setTileMode(enabled: boolean) {
        this.tileMode = enabled;
        this.gizmo.detach();

        if (enabled) {
            this.select(null);
            this.placeKind = null;
        } else {
            this.tileSelection.clear();
        }

        this.attachTileGizmo();
    }

    private attachTileGizmo() {
        if (!this.tileMode || this.tileSelection.isEmpty()) {
            this.gizmo.detach();
            events.emit('editorTileSelectionChanged', this.tileSelection.size, null);
            return;
        }

        // Y only, snapped to whole levels: a tile has no meaningful position
        // between levels, and none at all off its own column.
        this.gizmo.setMode('translate');
        this.gizmo.showX = false;
        this.gizmo.showZ = false;
        this.gizmo.setTranslationSnap(this.tiles.levelHeight);
        this.gizmo.attach(this.tileSelection.proxy);

        this.dragBaseY = this.tileSelection.proxy.position.y;
        events.emit('editorTileSelectionChanged', this.tileSelection.size, this.tileSelection.commonLevel(this.tiles));
    }

    /**
     * Turns gizmo travel into level changes. The proxy is re-centred on the
     * tiles after every applied step, so a long drag keeps producing steps
     * instead of measuring against a stale origin.
     */
    private dragTiles() {
        const delta = Math.round((this.tileSelection.proxy.position.y - this.dragBaseY) / this.tiles.levelHeight);
        if (delta === 0) return;

        for (const index of this.tileSelection.indices) {
            this.tiles.levels[index] = (this.tiles.levels[index] ?? 0) + delta;
        }

        this.rebuildTerrain();
        this.dragBaseY = this.tileSelection.proxy.position.y;
        events.emit('editorTileSelectionChanged', this.tileSelection.size, this.tileSelection.commonLevel(this.tiles));
    }

    private rebuildTerrain() {
        const grid = rebuildTileGrid(this.tiles);
        this.refreshGridHelper();
        this.experience.world.terrain.rebuild(this.tiles);
        this.tileSelection.refresh(grid);
        saveWorkingTiles(this.tiles);
        // Cliff steps are read from the tile grid by the nav grid, so the layout
        // has to be reloaded before anything is actually blocked by them.
        this.rebuild();
    }

    /** Keeps the reference grid matching the tile footprint after a resize. */
    private refreshGridHelper() {
        const visible = this.grid.visible;
        this.experience.scene.remove(this.grid);
        this.grid.geometry.dispose();

        this.grid = buildGridHelper(this.tiles);
        this.grid.visible = visible;
        this.experience.scene.add(this.grid);
    }

    private pickTerrainPoint(): THREE.Vector3 | null {
        const hits = this.raycaster.intersectObject(this.experience.world.terrain.mesh, false);
        return hits.length > 0 ? hits[0].point : null;
    }

    private pickEntityId(): string | null {
        const roots = this.experience.world.getEntities();
        const hits = this.raycaster.intersectObjects(roots.map((entity) => entity.mesh), true);
        if (hits.length === 0) return null;

        for (let object: THREE.Object3D | null = hits[0].object; object; object = object.parent) {
            const match = roots.find((entity) => entity.mesh === object);
            if (match) return match.id;
        }
        return null;
    }

    private placeAtCursor() {
        if (!this.placeKind) return;

        const point = this.pickTerrainPoint();
        if (!point) return;

        const snap = (value: number) => (this.shift ? value : Math.round(value / GRID_SNAP) * GRID_SNAP);
        const position: [number, number, number] = [snap(point.x), 0, snap(point.z)];

        const entity = createDefaultEntity(this.placeKind, this.placeVariant, position, this.layout);
        this.layout.push(entity);
        this.rebuild();
        this.select(entity.id);
    }

    private setShift(down: boolean) {
        if (this.shift === down) return;

        this.shift = down;
        this.gizmo.setTranslationSnap(down ? null : GRID_SNAP);
        this.gizmo.setRotationSnap(down ? null : ROTATION_SNAP);
    }

    /**
     * Replaces the layout entry with the version edited in the panel. The id may
     * have changed, so the entry is found by index captured before the edit.
     */
    private applyEdit(edited: MapEntity) {
        const index = this.layout.findIndex((entity) => entity.id === this.selectedId);
        if (index === -1) return;

        this.layout[index] = edited;
        this.rebuild();
        // Meshes were rebuilt from scratch, so re-attach the gizmo to the new one.
        this.select(edited.id);
    }

    private resetToSource() {
        clearWorkingLayout();
        clearWorkingTiles();
        this.tiles = sourceTiles();
        this.tileSelection.clear();
        rebuildTileGrid(this.tiles);
        this.experience.world.terrain.rebuild(this.tiles);
        this.layout = sourceLayout();
        this.select(null);
        this.rebuild();
    }

    private select(id: string | null) {
        this.selectedId = id;

        const entity = id ? this.experience.world.getEntities().find((e) => e.id === id) : undefined;
        if (entity) {
            // Tile mode hides these; entities move on every axis.
            this.gizmo.showX = true;
            this.gizmo.showZ = true;
            this.gizmo.attach(entity.mesh);
        } else {
            this.gizmo.detach();
        }

        events.emit('editorSelectionChanged', this.findInLayout(id) ?? null);
    }

    private findInLayout(id: string | null): MapEntity | undefined {
        return id ? this.layout.find((entity) => entity.id === id) : undefined;
    }

    private commitTransform() {
        const source = this.findInLayout(this.selectedId);
        const entity = this.selectedId
            ? this.experience.world.getEntities().find((e) => e.id === this.selectedId)
            : undefined;
        if (!source || !entity) return;

        Object.assign(source, readTransform(entity.mesh));
        saveWorkingLayout(this.layout);
        events.emit('editorSelectionChanged', source);
    }

    private deleteSelected() {
        if (!this.selectedId) return;

        this.layout = this.layout.filter((entity) => entity.id !== this.selectedId);
        this.select(null);
        this.rebuild();
    }

    private duplicateSelected() {
        const source = this.findInLayout(this.selectedId);
        if (!source) return;

        const copy = structuredClone(source);
        copy.id = uniqueId(source.kind, this.layout);
        copy.position = [source.position[0] + 1, source.position[1], source.position[2] + 1];

        this.layout.push(copy);
        this.rebuild();
        this.select(copy.id);
    }

    private rebuild() {
        this.experience.world.loadLayout(this.layout);
        saveWorkingLayout(this.layout);
        events.emit('editorLayoutChanged', this.layout.length);
    }

    private onKeyDown(event: KeyboardEvent) {
        if (stateMachine.getState() !== 'EDITOR') return;

        if (event.key === 'Shift') this.setShift(true);

        // Typing in an inspector field must not fire the editor shortcuts.
        if (document.activeElement instanceof HTMLInputElement) return;
        if (document.activeElement instanceof HTMLSelectElement) return;

        switch (event.code) {
            case 'KeyW': this.setMode('translate'); break;
            case 'KeyE': this.setMode('rotate'); break;
            case 'KeyR': this.setMode('scale'); break;
            case 'KeyX':
                // Ctrl+X is the browser cut shortcut; leave that alone.
                if (event.ctrlKey) break;
                this.deleteSelected();
                break;
            case 'Delete':
            case 'Backspace': this.deleteSelected(); break;
            case 'Escape': this.select(null); break;
            case 'KeyD':
                if (event.ctrlKey) {
                    event.preventDefault();
                    this.duplicateSelected();
                }
                break;
        }
    }

    private setMode(mode: 'translate' | 'rotate' | 'scale') {
        this.gizmo.setMode(mode);
        events.emit('editorGizmoChanged', mode);
    }
}

function buildGridHelper(map: TileMap): THREE.GridHelper {
    // One grid line per tile edge, so the helper reads as the tile grid itself
    // rather than an unrelated ruler laid over it.
    return new THREE.GridHelper(map.cols * map.tileSize, map.cols, 0x666666, 0x333333);
}
