import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { events } from '../../core/events';
import { stateMachine } from '../../core/StateMachine';
import type { MapEntity } from '../../data/MapEntity';
import { readTransform } from '../entities/applyTransform';
import type { Experience } from '../Experience';
import { downloadLayout, loadWorkingLayout, saveWorkingLayout } from './editorLayout';
import { createDefaultEntity, uniqueId } from './entityDefaults';

const GRID_SNAP = 0.5;

// Dev-only level editor: orbit camera, click to select, Unity-style W/E/R gizmos, click the
// ground to place the armed entity kind. Every gizmo drag writes straight back into the
// working layout, and the whole world is rebuilt from that layout — so what you see in the
// editor is literally what the game will build from the exported JSON, no preview code path.
export class EditorSystem {
    private experience: Experience;
    private orbit: OrbitControls;
    private gizmo: TransformControls;
    private raycaster = new THREE.Raycaster();
    private pointer = new THREE.Vector2();
    private groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    private grid: THREE.GridHelper;

    private layout: MapEntity[] = loadWorkingLayout();
    private selectedId: string | null = null;
    private placeKind: MapEntity['kind'] | null = null;
    private placeVariant = '';

    constructor(experience: Experience) {
        this.experience = experience;
        const { camera, canvas, scene } = this.experience;

        this.orbit = new OrbitControls(camera, canvas);
        this.orbit.enabled = false;

        this.gizmo = new TransformControls(camera, canvas);
        this.gizmo.setTranslationSnap(GRID_SNAP);
        this.gizmo.setRotationSnap(Math.PI / 12);
        // getHelper() is the visual half of the controls; since r169 the controls object
        // itself is not an Object3D, so this is what actually goes into the scene.
        scene.add(this.gizmo.getHelper());

        this.grid = new THREE.GridHelper(50, 100, 0x666666, 0x333333);
        this.grid.visible = false;
        scene.add(this.grid);

        // Orbiting while dragging a gizmo axis would fight the drag, so they take turns.
        this.gizmo.addEventListener('dragging-changed', (event) => {
            this.orbit.enabled = !event.value;
        });

        // Writing on every frame of the drag keeps the layout the single source of truth,
        // so an export mid-session can never be stale.
        this.gizmo.addEventListener('objectChange', () => this.commitTransform());

        canvas.addEventListener('pointerdown', (event) => this.onPointerDown(event));
        window.addEventListener('keydown', (event) => this.onKeyDown(event));

        events.on('editorPlaceKindChanged', (kind, variant) => {
            this.placeKind = kind;
            this.placeVariant = variant;
            this.select(null);
        });
        events.on('editorGizmoChanged', (mode) => this.gizmo.setMode(mode));
        events.on('editorExportRequested', () => downloadLayout(this.layout));

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
        // A click that started on a gizmo axis is a drag, not a selection.
        if (this.gizmo.dragging) return;

        this.pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
        this.raycaster.setFromCamera(this.pointer, this.experience.camera);

        if (this.placeKind) {
            this.placeAtCursor();
            return;
        }

        this.select(this.pickEntityId());
    }

    // Meshes are often groups (statue, bonfire), so the hit object can be a child several
    // levels down — walk up to whichever ancestor the world registered as the entity root.
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

        const point = new THREE.Vector3();
        if (!this.raycaster.ray.intersectPlane(this.groundPlane, point)) return;

        const snapped: [number, number, number] = [
            Math.round(point.x / GRID_SNAP) * GRID_SNAP,
            0,
            Math.round(point.z / GRID_SNAP) * GRID_SNAP,
        ];

        const entity = createDefaultEntity(this.placeKind, this.placeVariant, snapped, this.layout);
        this.layout.push(entity);
        this.rebuild();
        this.select(entity.id);
    }

    private select(id: string | null) {
        this.selectedId = id;

        const entity = id ? this.experience.world.getEntities().find((e) => e.id === id) : undefined;
        if (entity) {
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

    // Rebuilding the whole world after a structural change (add/delete) is cheap at this
    // map size and removes a whole class of "scene and data drifted apart" bugs.
    private rebuild() {
        this.experience.world.loadLayout(this.layout);
        saveWorkingLayout(this.layout);
        events.emit('editorLayoutChanged', this.layout.length);
    }

    private onKeyDown(event: KeyboardEvent) {
        if (stateMachine.getState() !== 'EDITOR') return;

        switch (event.code) {
            case 'KeyW': this.setMode('translate'); break;
            case 'KeyE': this.setMode('rotate'); break;
            case 'KeyR': this.setMode('scale'); break;
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
