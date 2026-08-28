import type { Project } from '../data/Project';
import { projects } from './../data/projects';

const STORAGE_KEY = 'rpg-portfolio:discovered';

export interface DiscoveryEntry {
    project: Project;
    discovered: boolean;
}

// Which projects the player has found in the game world.
// Pure state + lookups: the book UI reads it to decide locked vs unlocked,
// the statue glow reads it to decide whether to keep shining. No DOM, no Three.
const discovered = new Set<string>(load());

// localStorage can throw (private mode, disabled storage) and can hold anything a user
// typed into devtools, so reads are guarded and non-array payloads fall back to empty.
function load(): string[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const parsed: unknown = raw ? JSON.parse(raw) : null;
        return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
    } catch {
        return [];
    }
}

function save() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...discovered]));
    } catch {
        // Progress persistence is a nice-to-have; never break the run over it.
    }
}

export function getProject(projectId: string): Project | undefined {
    return projects.find((project) => project.id === projectId);
}

export function isDiscovered(projectId: string): boolean {
    return discovered.has(projectId);
}

// Every project, tagged with its state — the book renders this directly instead of
// re-deriving "which are locked" in the DOM layer.
export function getDiscoveryList(): DiscoveryEntry[] {
    return projects.map((project) => ({ project, discovered: discovered.has(project.id) }));
}

// Returns the project only when this call is what discovered it, so callers can
// fire "new discovery" feedback without tracking previous state themselves.
export function discover(projectId: string): Project | undefined {
    const project = getProject(projectId);
    if (!project || discovered.has(projectId)) return undefined;

    discovered.add(projectId);
    save();
    return project;
}

export function resetDiscoveries() {
    discovered.clear();
    save();
}
