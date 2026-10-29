import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { events } from '../../core/events';
import { stateMachine } from '../../core/StateMachine';
import type { MapEntity } from '../../data/MapEntity';
import { readTransform, seatedHeight } from '../entities/applyTransform';
import type { Experience } from '../Experience';
import {
    clearWorkingLayout,
    clearWorkingTiles,
    copyLayout,
    copyTiles,
    downloadLayout,
    downloadTiles,
    loadWorkingLayout,
    loadWorkingTiles,
    saveWorkingLayout,
    saveWorkingTiles,
    sourceLayout,
    sourceTiles,
} from './editorLayout';
import { getTileGrid, groundHeight, rebuildTileGrid } from '../world/terrainField';
import { resizeTileMap, type TileMap } from '../../data/tileMap';
import { TileSelection } from './TileSelection';
import { createDefaultEntity, uniqueId } from './entityDefaults';
import { DEFAULT_SCATTER, DEFAULT_TILE_BRUSH_RADIUS, type ScatterSettings, type ScreenRect } from '../../core/editorTools';
import { UndoHistory, type EditorSnapshot } from './UndoHistory';
import { BrushCursor, ScatterGhosts } from './brushVisuals';
import { eraseStamp, scatterStamp } from './scatter';
import { EDITOR_LAYER } from '../render/layers';

const GRID_SNAP = 1;
const ROTATION_SNAP = Math.PI / 12;
/** Pixels the pointer must travel before a press counts as a box drag rather than a click. */
const DRAG_THRESHOLD = 4;

/**
 * What the left button is doing between press and release. Each stroke keeps
 * its own state, so a release always ends exactly the action its press began,
 * even if a mode button was clicked mid-drag.
 */
type PointerAction =
    | { kind: 'box'; startX: number; startY: number; rect: ScreenRect | null; tiles: boolean; ctrl: boolean; shift: boolean }
    | { kind: 'tileBrush'; remove: boolean }
    | { kind: 'scatter'; erase: boolean; last: THREE.Vector3 | null; before: EditorSnapshot; changed: boolean };

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
    private workingCopyApplied = false;
    /** Proxy height when the current gizmo drag started, to measure travel from. */
    private dragBaseY = 0;
    private selectedIds = new Set<string>();
    /**
     * What the gizmo grabs when several entities are selected: it can only hold
     * one object, so it holds this empty at their centre and every selected
     * mesh follows it by the offset it had when the drag started.
     */
    private pivot = new THREE.Object3D();
    private pivotOffsets = new Map<string, THREE.Matrix4>();
    private placeKind: MapEntity['kind'] | null = null;
    private placeVariant = '';
    /** Held Shift bypasses snapping, both for the gizmo and for click placement. */
    private shift = false;

    private action: PointerAction | null = null;
    private tileBrush = false;
    private tileBrushRadius = DEFAULT_TILE_BRUSH_RADIUS;
    private scatterArmed = false;
    private scatter: ScatterSettings = DEFAULT_SCATTER;
    private brushCursor: BrushCursor;
    private ghosts: ScatterGhosts;

    private history = new UndoHistory();
    /** State when the current gizmo drag began; pushed on release only if the drag changed anything. */
    private dragSnapshot: EditorSnapshot | null = null;

    constructor(experience: Experience) {
        this.experience = experience;
        const { camera, canvas, scene } = this.experience;

        // A raycaster, like a camera, only hits layer 0 by default; trigger volumes sit
        // on the editor layer. Their edges are what gets picked, so keep the line
        // threshold (world units around a line that count as a hit) tight.
        this.raycaster.layers.enable(EDITOR_LAYER);
        this.raycaster.params.Line.threshold = 0.25;

        this.orbit = new OrbitControls(camera, canvas);
        this.orbit.enabled = false;
        // Unity's scheme: the left button belongs to selection and brushes, so
        // the camera moves on the other two.
        this.orbit.mouseButtons = { LEFT: null, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.ROTATE };

        this.gizmo = new TransformControls(camera, canvas);
        this.gizmo.setTranslationSnap(GRID_SNAP);
        this.gizmo.setRotationSnap(ROTATION_SNAP);

        scene.add(this.gizmo.getHelper());
        scene.add(this.pivot);

        this.grid = buildGridHelper(this.tiles);
        this.grid.visible = false;
        scene.add(this.grid);

        this.gizmo.addEventListener('dragging-changed', (event) => {
            this.orbit.enabled = !event.value;
            if (event.value) {
                this.dragSnapshot = this.snapshot();
                if (this.gizmo.object === this.pivot) this.capturePivotOffsets();
            } else {
                this.commitDragHistory();
            }
        });

        this.gizmo.addEventListener('objectChange', () => {
            if (this.tileMode) {
                this.dragTiles();
                return;
            }
            if (this.gizmo.object === this.pivot) this.followPivot();
            this.commitTransform();
        });

        canvas.addEventListener('pointerdown', (event) => this.onPointerDown(event));
        // On window, not canvas: a drag that ends over the editor panel must still end.
        window.addEventListener('pointermove', (event) => this.onPointerMove(event));
        window.addEventListener('pointerup', (event) => {
            if (event.button === 0) this.endAction();
        });
        window.addEventListener('keydown', (event) => this.onKeyDown(event));
        window.addEventListener('keyup', (event) => {
            if (event.key === 'Shift') this.setShift(false);
        });
        // Alt-tabbing away with Shift down would otherwise leave snapping off forever.
        window.addEventListener('blur', () => {
            this.setShift(false);
            this.endAction();
        });

        events.on('editorPlaceKindChanged', (kind, variant) => {
            this.placeKind = kind;
            this.placeVariant = variant;
            this.select([]);
        });
        events.on('editorGizmoChanged', (mode) => this.gizmo.setMode(mode));
        // Both halves of the map: the terrain only lives in this browser's storage until exported.
        events.on('editorExportRequested', () => {
            downloadLayout(this.layout);
            downloadTiles(this.tiles);
        });
        events.on('editorCopyRequested', () => copyLayout(this.layout));
        events.on('editorResetRequested', () => this.resetToSource());
        events.on('editorEntityEdited', (edited) => this.applyEdit(edited));
        events.on('editorTerrainCopyRequested', () => copyTiles(this.tiles));
        events.on('editorTileModeChanged', (enabled) => this.setTileMode(enabled));
        events.on('editorWaterLevelChanged', (level) => {
            this.record();
            this.tiles = { ...this.tiles, waterLevel: level };
            // A full terrain rebuild, not just the water mesh: the nav grid
            // blocks underwater cells, so the shoreline it walks has moved too.
            this.rebuildTerrain();
        });
        events.on('editorTileGridResized', (cols, rows) => {
            this.record();
            this.tiles = resizeTileMap(this.tiles, cols, rows);
            this.tileSelection.clear();
            this.rebuildTerrain();
        });
        events.on('editorTileBrushChanged', (enabled, radius) => {
            this.tileBrush = enabled;
            this.tileBrushRadius = radius;
            this.brushCursor.hide();
        });
        events.on('editorScatterArmed', (enabled) => {
            this.scatterArmed = enabled;
            this.brushCursor.hide();
            if (enabled) this.select([]);
        });
        events.on('editorScatterChanged', (settings) => {
            this.scatter = settings;
        });
        events.on('editorUndoRequested', () => this.undo());
        events.on('editorRedoRequested', () => this.redo());

        this.tileSelection = new TileSelection(scene);
        this.brushCursor = new BrushCursor(scene);
        this.ghosts = new ScatterGhosts(scene);

        if (this.hasUnsavedWorkingCopy()) {
            console.info('[editor] a local working copy of the map exists; it replaces the committed map the first time the editor opens (F1)');
        }
    }

    /**
     * The localStorage working copy only takes over once the editor is opened.
     * Applying it at startup made `npm run dev` play a different map from the
     * committed one the production build ships, with nothing on screen saying so.
     */
    private applyWorkingCopy() {
        if (this.workingCopyApplied) return;
        this.workingCopyApplied = true;

        rebuildTileGrid(this.tiles);
        this.experience.world.rebuildTerrain(this.tiles);
        this.experience.world.loadLayout(this.layout);
    }

    private hasUnsavedWorkingCopy(): boolean {
        return JSON.stringify(this.layout) !== JSON.stringify(sourceLayout())
            || JSON.stringify(this.tiles) !== JSON.stringify(sourceTiles());
    }

    public enter() {
        this.applyWorkingCopy();
        const { camera } = this.experience;
        // Trigger volumes live on this layer: drawn and pickable only while editing.
        camera.layers.enable(EDITOR_LAYER);
        this.orbit.target.copy(this.experience.world.player.mesh.position);
        this.orbit.enabled = true;
        this.orbit.update();

        this.grid.visible = true;
        camera.updateMatrixWorld();
        events.emit('editorLayoutChanged', this.layout.length);
        this.emitHistory();
    }

    public exit() {
        this.endAction();
        this.brushCursor.hide();
        this.select([]);
        this.orbit.enabled = false;
        this.grid.visible = false;
        this.experience.camera.layers.disable(EDITOR_LAYER);
        this.experience.world.resetCamera();
    }

    public update() {
        if (stateMachine.getState() !== 'EDITOR') return;
        this.orbit.update();
    }

    private aimAt(clientX: number, clientY: number) {
        this.pointer.x = (clientX / window.innerWidth) * 2 - 1;
        this.pointer.y = -(clientY / window.innerHeight) * 2 + 1;
        this.raycaster.setFromCamera(this.pointer, this.experience.camera);
    }

    /**
     * Only starts an action; what a press *means* is often only known on
     * release (a box needs the drag, a click needs the absence of one).
     */
    private onPointerDown(event: PointerEvent) {
        if (stateMachine.getState() !== 'EDITOR' || event.button !== 0) return;

        // TransformControls listens on the same canvas and registered first, so
        // a press on a gizmo handle has already started its drag by now.
        if (this.gizmo.dragging) return;

        this.aimAt(event.clientX, event.clientY);

        if (this.tileMode && this.tileBrush) {
            this.action = { kind: 'tileBrush', remove: event.ctrlKey };
            this.paintTiles(event.ctrlKey);
            return;
        }

        if (this.tileMode || !(this.scatterArmed || this.placeKind)) {
            this.action = {
                kind: 'box',
                startX: event.clientX,
                startY: event.clientY,
                rect: null,
                tiles: this.tileMode,
                ctrl: event.ctrlKey,
                shift: event.shiftKey,
            };
            return;
        }

        if (this.scatterArmed) {
            const action: PointerAction = { kind: 'scatter', erase: event.ctrlKey, last: null, before: this.snapshot(), changed: false };
            this.action = action;
            this.stampScatter(action);
            return;
        }

        this.placeAtCursor();
    }

    private onPointerMove(event: PointerEvent) {
        if (stateMachine.getState() !== 'EDITOR') return;

        this.aimAt(event.clientX, event.clientY);
        this.updateBrushCursor(event.ctrlKey);

        const action = this.action;
        if (!action) return;

        switch (action.kind) {
            case 'box': {
                const dx = event.clientX - action.startX;
                const dy = event.clientY - action.startY;
                if (!action.rect && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;

                action.rect = {
                    left: Math.min(action.startX, event.clientX),
                    top: Math.min(action.startY, event.clientY),
                    width: Math.abs(dx),
                    height: Math.abs(dy),
                };
                events.emit('editorBoxChanged', action.rect);
                break;
            }
            case 'tileBrush':
                this.paintTiles(action.remove);
                break;
            case 'scatter':
                this.stampScatter(action);
                break;
        }
    }

    private endAction() {
        const action = this.action;
        if (!action) return;
        this.action = null;

        if (action.kind === 'box') {
            if (action.rect) {
                events.emit('editorBoxChanged', null);
                if (action.tiles) this.boxSelectTiles(action.rect, action.ctrl || action.shift);
                else this.boxSelectEntities(action.rect, action.ctrl);
            } else {
                this.aimAt(action.startX, action.startY);
                this.clickSelect(action);
            }
            return;
        }

        if (action.kind === 'scatter') this.endScatter(action);
    }

    private clickSelect(action: Extract<PointerAction, { kind: 'box' }>) {
        if (action.tiles) {
            this.pickTile(action.shift || action.ctrl);
            return;
        }

        const id = this.pickEntityId();
        if (action.ctrl) {
            // Ctrl-clicking empty ground keeps the selection: a near miss while
            // building up a group should not throw the whole group away.
            if (id) this.toggleSelected(id);
            return;
        }
        this.select(id ? [id] : []);
    }

    /** Converts a world point to client pixels; null when it is behind the camera. */
    private toScreen(point: THREE.Vector3): { x: number; y: number } | null {
        point.project(this.experience.camera);
        if (point.z > 1) return null;

        return {
            x: ((point.x + 1) / 2) * window.innerWidth,
            y: ((1 - point.y) / 2) * window.innerHeight,
        };
    }

    private isInRect(point: THREE.Vector3, rect: ScreenRect): boolean {
        const screen = this.toScreen(point);
        return !!screen
            && screen.x >= rect.left && screen.x <= rect.left + rect.width
            && screen.y >= rect.top && screen.y <= rect.top + rect.height;
    }

    /**
     * Tests the layout, not the scene: entities in chunks the streamer has not
     * loaded have no mesh, but they are still on the map and still selectable.
     */
    private boxSelectEntities(rect: ScreenRect, extend: boolean) {
        const point = new THREE.Vector3();
        const ids = this.layout
            .filter((entity) => {
                const [x, , z] = entity.position;
                return this.isInRect(point.set(x, groundHeight(x, z), z), rect);
            })
            .map((entity) => entity.id);

        this.select(extend ? [...this.selectedIds, ...ids] : ids);
    }

    private boxSelectTiles(rect: ScreenRect, extend: boolean) {
        const grid = getTileGrid();
        const { cols, rows, levelHeight } = grid.map;
        const point = new THREE.Vector3();
        const inside: number[] = [];

        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                point.set(grid.tileCenterX(col), grid.levelAt(col, row) * levelHeight, grid.tileCenterZ(row));
                if (this.isInRect(point, rect)) inside.push(grid.index(col, row));
            }
        }

        this.tileSelection.apply(inside, extend ? 'add' : 'replace', grid);
        this.attachTileGizmo();
    }

    private brushRadius(): number | null {
        if (this.tileMode && this.tileBrush) return this.tileBrushRadius * this.tiles.tileSize;
        if (this.scatterArmed && !this.tileMode) return this.scatter.radius;
        return null;
    }

    private updateBrushCursor(erase: boolean) {
        const radius = this.brushRadius();
        const point = radius === null ? null : this.pickTerrainPoint();

        if (radius === null || !point) this.brushCursor.hide();
        else this.brushCursor.show(point, radius, erase);
    }

    /**
     * Tiles whose centre falls inside the brush, plus always the tile under the
     * cursor, so the smallest brush still paints the tile you are pointing at.
     */
    private paintTiles(remove: boolean) {
        const point = this.pickTerrainPoint();
        if (!point) return;

        const grid = getTileGrid();
        const radius = this.tileBrushRadius * this.tiles.tileSize;
        const touched = [grid.index(grid.colAt(point.x), grid.rowAt(point.z))];

        for (let row = grid.rowAt(point.z - radius); row <= grid.rowAt(point.z + radius); row++) {
            for (let col = grid.colAt(point.x - radius); col <= grid.colAt(point.x + radius); col++) {
                const dx = grid.tileCenterX(col) - point.x;
                const dz = grid.tileCenterZ(row) - point.z;
                if (dx * dx + dz * dz <= radius * radius) touched.push(grid.index(col, row));
            }
        }

        this.tileSelection.apply(touched, remove ? 'remove' : 'add', grid);
        this.attachTileGizmo();
    }

    /**
     * One stamp each time the cursor has travelled `stampSpacing` along the
     * ground. The layout changes right away; the world is rebuilt once, on
     * release, with ghosts and hidden meshes standing in until then.
     */
    private stampScatter(action: Extract<PointerAction, { kind: 'scatter' }>) {
        const point = this.pickTerrainPoint();
        if (!point) return;

        if (action.last) {
            const travelled = Math.hypot(point.x - action.last.x, point.z - action.last.z);
            if (travelled < this.scatter.stampSpacing) return;
        }
        action.last = point.clone();

        if (action.erase) {
            const erased = new Set(eraseStamp(point.x, point.z, this.scatter, this.layout));
            if (erased.size === 0) return;

            this.layout = this.layout.filter((entity) => !erased.has(entity.id));
            for (const entity of this.experience.world.getEntities()) {
                if (erased.has(entity.id)) entity.mesh.visible = false;
            }
            action.changed = true;
            return;
        }

        const placed = scatterStamp(point.x, point.z, this.scatter, this.layout);
        if (placed.length === 0) return;

        this.ghosts.add(placed);
        action.changed = true;
    }

    private endScatter(action: Extract<PointerAction, { kind: 'scatter' }>) {
        this.ghosts.clear();
        if (!action.changed) return;

        this.history.push(action.before);
        this.rebuild();
        this.emitHistory();
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
            this.select([]);
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
        this.experience.world.rebuildTerrain(this.tiles);
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

        this.record();
        const entity = createDefaultEntity(this.placeKind, this.placeVariant, position, this.layout);
        this.layout.push(entity);
        this.rebuild();
        this.select([entity.id]);
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
        // The inspector only edits a single selection.
        if (this.selectedIds.size !== 1) return;
        const [selectedId] = this.selectedIds;

        const index = this.layout.findIndex((entity) => entity.id === selectedId);
        if (index === -1) return;

        this.record();
        this.layout[index] = edited;
        this.rebuild();
        // Meshes were rebuilt from scratch, so re-attach the gizmo to the new one.
        this.select([edited.id]);
    }

    private resetToSource() {
        this.record();
        clearWorkingLayout();
        clearWorkingTiles();
        this.tiles = sourceTiles();
        this.tileSelection.clear();
        rebuildTileGrid(this.tiles);
        this.experience.world.terrain.rebuild(this.tiles);
        this.layout = sourceLayout();
        this.select([]);
        this.rebuild();
    }

    private select(ids: string[]) {
        this.selectedIds = new Set(ids);
        this.attachEntityGizmo();
        this.emitSelection();
    }

    private toggleSelected(id: string) {
        if (this.selectedIds.has(id)) this.selectedIds.delete(id);
        else this.selectedIds.add(id);

        this.attachEntityGizmo();
        this.emitSelection();
    }

    /**
     * One entity: the gizmo holds its mesh, so rotation and scale stay in its
     * own frame. Several: the gizmo holds the pivot, reset to their centre with
     * no rotation or scale, so a rotate turns the group around its middle.
     */
    private attachEntityGizmo() {
        const meshes = this.selectedEntities().map((entity) => entity.mesh);

        if (meshes.length === 0) {
            this.gizmo.detach();
            return;
        }

        // Tile mode hides these; entities move on every axis.
        this.gizmo.showX = true;
        this.gizmo.showZ = true;

        if (meshes.length === 1) {
            this.gizmo.attach(meshes[0]);
            return;
        }

        const center = new THREE.Vector3();
        for (const mesh of meshes) center.add(mesh.getWorldPosition(new THREE.Vector3()));

        this.pivot.position.copy(center.divideScalar(meshes.length));
        this.pivot.rotation.set(0, 0, 0);
        this.pivot.scale.set(1, 1, 1);
        this.gizmo.attach(this.pivot);
    }

    /**
     * Records each mesh relative to the pivot (inverse pivot × mesh, in world
     * space) once per drag, before the pivot moves. Re-deriving it every frame
     * from the already-moved meshes would compound rounding drift.
     */
    private capturePivotOffsets() {
        this.pivot.updateMatrixWorld();
        const inversePivot = this.pivot.matrixWorld.clone().invert();

        this.pivotOffsets.clear();
        for (const entity of this.selectedEntities()) {
            entity.mesh.updateMatrixWorld();
            this.pivotOffsets.set(entity.id, inversePivot.clone().multiply(entity.mesh.matrixWorld));
        }
    }

    /** Puts every selected mesh back at pivot × offset, expressed in its parent's frame. */
    private followPivot() {
        this.pivot.updateMatrixWorld();
        const local = new THREE.Matrix4();
        const inverseParent = new THREE.Matrix4();

        for (const entity of this.selectedEntities()) {
            const offset = this.pivotOffsets.get(entity.id);
            if (!offset) continue;

            local.multiplyMatrices(this.pivot.matrixWorld, offset);
            if (entity.mesh.parent) local.premultiply(inverseParent.copy(entity.mesh.parent.matrixWorld).invert());
            local.decompose(entity.mesh.position, entity.mesh.quaternion, entity.mesh.scale);
        }
    }

    private selectedEntities() {
        return this.experience.world.getEntities().filter((entity) => this.selectedIds.has(entity.id));
    }

    private selectedSources(): MapEntity[] {
        return this.layout.filter((entity) => this.selectedIds.has(entity.id));
    }

    private emitSelection() {
        events.emit('editorSelectionChanged', this.selectedSources());
    }

    private commitTransform() {
        // Only a drag on the Y handle authors a height. Any other drag keeps the
        // offset the entity already had and re-seats it on the ground under its
        // new spot; reading Y back would bake the slope it crossed into an offset.
        const authorsHeight = this.gizmo.mode === 'translate' && (this.gizmo.axis?.includes('Y') ?? false);

        for (const entity of this.selectedEntities()) {
            const source = this.layout.find((candidate) => candidate.id === entity.id);
            if (!source) continue;

            if (!authorsHeight) {
                const { x, z } = entity.mesh.position;
                entity.mesh.position.y = seatedHeight(x, z, source.heightOffset, entity.groundOffset);
            }
            const transform = readTransform(entity.mesh, entity.groundOffset);
            Object.assign(source, transform);
            // Object.assign copies an undefined key as a key; drop it so the export stays clean.
            if (transform.heightOffset === undefined) delete source.heightOffset;
        }

        // The meshes already stand where they were dropped; the nav grid (what
        // actually blocks walkers) and the bare grass under them do not yet.
        this.experience.world.refreshFootprints(this.layout);
        saveWorkingLayout(this.layout);
        this.emitSelection();
    }

    private deleteSelected() {
        if (this.selectedIds.size === 0) return;

        this.record();
        this.layout = this.layout.filter((entity) => !this.selectedIds.has(entity.id));
        this.select([]);
        this.rebuild();
    }

    private duplicateSelected() {
        if (this.selectedIds.size === 0) return;

        this.record();
        const copies = this.selectedSources().map((source) => {
            const copy = structuredClone(source);
            // Pushed one at a time, so each uniqueId sees the copies made before it.
            copy.id = uniqueId(source.kind, this.layout);
            copy.position = [source.position[0] + 1, source.position[1], source.position[2] + 1];
            this.layout.push(copy);
            return copy;
        });
        if (copies.length === 0) return;

        this.rebuild();
        this.select(copies.map((copy) => copy.id));
    }

    private snapshot(): EditorSnapshot {
        return structuredClone({ layout: this.layout, tiles: this.tiles });
    }

    /** Call before a change, with the state the change is about to replace. */
    private record() {
        this.history.push(this.snapshot());
        this.emitHistory();
    }

    /** A gizmo press without any travel is not worth an undo step. */
    private commitDragHistory() {
        const before = this.dragSnapshot;
        this.dragSnapshot = null;
        if (!before) return;

        const unchanged = JSON.stringify(before.layout) === JSON.stringify(this.layout)
            && JSON.stringify(before.tiles.levels) === JSON.stringify(this.tiles.levels);
        if (unchanged) return;

        this.history.push(before);
        this.emitHistory();
    }

    private undo() {
        this.restore(this.history.undo(this.snapshot()));
    }

    private redo() {
        this.restore(this.history.redo(this.snapshot()));
    }

    private restore(snapshot: EditorSnapshot | null) {
        if (!snapshot) return;
        // Mid-stroke, the stroke's own state would point at a layout that no longer exists.
        this.action = null;
        this.ghosts.clear();

        this.layout = snapshot.layout;
        this.tiles = snapshot.tiles;
        this.select([]);
        this.tileSelection.clear();
        this.attachTileGizmo();
        this.rebuildTerrain();
        this.emitHistory();
    }

    private emitHistory() {
        events.emit('editorHistoryChanged', this.history.canUndo, this.history.canRedo);
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

        // `key`, not `code`: `code` is the physical key, which is W on an AZERTY
        // board. Undo should follow the letter printed on the key.
        const letter = event.key.toLowerCase();
        if (event.ctrlKey && (letter === 'z' || letter === 'y')) {
            event.preventDefault();
            if (letter === 'y' || event.shiftKey) this.redo();
            else this.undo();
            return;
        }

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
            case 'Escape': this.select([]); break;
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
