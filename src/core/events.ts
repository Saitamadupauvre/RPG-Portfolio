import type { AppState } from './StateMachine';
import type { MapEntity } from '../data/MapEntity';
import type { Project } from '../data/Project';
import type { PlayerStats } from '../data/stats';
import type { TutorialId } from '../data/tutorials';
import { EventEmitter } from './EventEmitter';
import type { ScatterSettings, ScreenRect } from './editorTools';

/** What the interact prompt shows: a key and what pressing it does. */
export type PromptAction = { key: string; label: string };

export type AppEvents = {
    stateChange: [newState: AppState, oldState: AppState];
    /** A project entered the discovered set for the first time. */
    projectDiscovered: [project: Project];
    /** Open the book on this project's page: new discovery or re-reading a statue. */
    projectShown: [project: Project];
    interactPromptChange: [actions: readonly PromptAction[] | null];
    playerHealthChanged: [hp: number, maxHp: number];

    playerDied: [screenX: number, screenY: number];
    playerRespawned: [screenX: number, screenY: number];
    bonfireRested: [];
    coinsChanged: [coins: number];
    chestOpened: [messages: string[]];
    playerStatsChanged: [stats: PlayerStats];
    /** Open the book on the Level page (bonfire's level-up action). */
    levelUpRequested: [];
    /** Whether the player stands at a bonfire, the only place stats can be bought. */
    levelUpAvailableChanged: [available: boolean];
    pauseChanged: [paused: boolean];
    /** A trigger opened a tutorial: show its page in the book. */
    tutorialShown: [tutorialId: TutorialId];

    editorPlaceKindChanged: [kind: MapEntity['kind'] | null, variant: string];
    editorGizmoChanged: [mode: 'translate' | 'rotate' | 'scale'];
    editorExportRequested: [];
    editorCopyRequested: [];
    editorResetRequested: [];
    editorEntityEdited: [entity: MapEntity];
    editorSelectionChanged: [entities: MapEntity[]];
    editorLayoutChanged: [count: number];
    editorTileModeChanged: [enabled: boolean];
    editorTileGridResized: [cols: number, rows: number];
    editorWaterLevelChanged: [level: number];
    editorTileSelectionChanged: [count: number, level: number | null];
    editorTerrainCopyRequested: [];
    /** The box-select rectangle while dragging, null once released. */
    editorBoxChanged: [rect: ScreenRect | null];
    /** Radius in tiles. */
    editorTileBrushChanged: [enabled: boolean, radius: number];
    editorScatterArmed: [enabled: boolean];
    editorScatterChanged: [settings: ScatterSettings];
    editorUndoRequested: [];
    editorRedoRequested: [];
    editorHistoryChanged: [canUndo: boolean, canRedo: boolean];
};

export const events = new EventEmitter<AppEvents>();
