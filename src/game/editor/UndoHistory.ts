import type { MapEntity } from '../../data/MapEntity';
import type { TileMap } from '../../data/tileMap';

export type EditorSnapshot = { layout: MapEntity[]; tiles: TileMap };

const LIMIT = 50;

/**
 * Whole-state snapshots rather than per-action inverse operations. A map is a
 * few hundred entities and a few thousand tile levels, so a copy per step is
 * cheap, and no action can ever forget to write its own "undo" half.
 */
export class UndoHistory {
    private undoStack: EditorSnapshot[] = [];
    private redoStack: EditorSnapshot[] = [];

    public get canUndo(): boolean {
        return this.undoStack.length > 0;
    }

    public get canRedo(): boolean {
        return this.redoStack.length > 0;
    }

    /** Records the state from *before* a change. A new change makes the redo branch unreachable. */
    public push(before: EditorSnapshot) {
        this.undoStack.push(before);
        if (this.undoStack.length > LIMIT) this.undoStack.shift();
        this.redoStack.length = 0;
    }

    public undo(current: EditorSnapshot): EditorSnapshot | null {
        const previous = this.undoStack.pop();
        if (!previous) return null;

        this.redoStack.push(current);
        return previous;
    }

    public redo(current: EditorSnapshot): EditorSnapshot | null {
        const next = this.redoStack.pop();
        if (!next) return null;

        this.undoStack.push(current);
        return next;
    }
}
