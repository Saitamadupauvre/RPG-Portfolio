import type { AppState } from './StateMachine';
import type { ItemEntity } from '../data/MapEntity';
import type { MapEntity } from '../data/MapEntity';
import type { Project } from '../data/Project';
import { EventEmitter } from './EventEmitter';

export type AppEvents = {
    stateChange: [newState: AppState, oldState: AppState];
    itemCollected: [item: ItemEntity];
    projectDiscovered: [project: Project];
    interactPromptChange: [label: string | null];
    playerHealthChanged: [hp: number, maxHp: number];
    // Screen-space center (px) for the cartoon iris wipe, so the UI doesn't need the camera.
    playerDied: [screenX: number, screenY: number];
    playerRespawned: [screenX: number, screenY: number];
    bonfireRested: [];
    pauseChanged: [paused: boolean];
    // Editor (dev only). UI -> game: what to place / which gizmo. game -> UI: what's selected.
    editorPlaceKindChanged: [kind: MapEntity['kind'], variant: string];
    editorGizmoChanged: [mode: 'translate' | 'rotate' | 'scale'];
    editorExportRequested: [];
    editorSelectionChanged: [entity: MapEntity | null];
    editorLayoutChanged: [count: number];
};

export const events = new EventEmitter<AppEvents>();
