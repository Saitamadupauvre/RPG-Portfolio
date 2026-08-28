import type { AppState } from './StateMachine';
import type { MapEntity } from '../data/MapEntity';
import type { Project } from '../data/Project';
import type { PlayerStats } from '../domain/playerProgress';
import { EventEmitter } from './EventEmitter';

/** What the interact prompt shows: a key and what pressing it does. */
export type PromptAction = { key: string; label: string };

export type AppEvents = {
    stateChange: [newState: AppState, oldState: AppState];
    projectDiscovered: [project: Project];
    interactPromptChange: [actions: readonly PromptAction[] | null];
    playerHealthChanged: [hp: number, maxHp: number];

    playerDied: [screenX: number, screenY: number];
    playerRespawned: [screenX: number, screenY: number];
    bonfireRested: [];
    coinsChanged: [coins: number];
    chestOpened: [messages: string[]];
    playerStatsChanged: [stats: PlayerStats];
    upgradeBoardRequested: [];
    pauseChanged: [paused: boolean];

    editorPlaceKindChanged: [kind: MapEntity['kind'], variant: string];
    editorGizmoChanged: [mode: 'translate' | 'rotate' | 'scale'];
    editorExportRequested: [];
    editorSelectionChanged: [entity: MapEntity | null];
    editorLayoutChanged: [count: number];
};

export const events = new EventEmitter<AppEvents>();
