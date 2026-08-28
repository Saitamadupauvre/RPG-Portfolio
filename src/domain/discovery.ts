import type { Project } from '../data/Project';
import { findProject, projects } from '../data/projects';

const STORAGE_KEY = 'rpg-portfolio:discovered';

export type DiscoveryEntry = {
    project: Project;
    discovered: boolean;
};

const discovered = new Set<string>(load());

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
    }
}

export function isDiscovered(projectId: string): boolean {
    return discovered.has(projectId);
}

export function getDiscoveryList(): DiscoveryEntry[] {
    return projects.map((project) => ({ project, discovered: discovered.has(project.id) }));
}

export function discover(projectId: string): Project | undefined {
    const project = findProject(projectId);
    if (!project || discovered.has(projectId)) return undefined;

    discovered.add(projectId);
    save();
    return project;
}

export function resetDiscoveries() {
    discovered.clear();
    save();
}
