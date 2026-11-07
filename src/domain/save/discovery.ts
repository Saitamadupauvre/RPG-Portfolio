import type { Project } from '../data/Project';
import { findProject } from '../data/projects';
import { createPersistentSet } from './persistence';

const discovered = createPersistentSet('rpg-portfolio:discovered');

export function isDiscovered(projectId: string): boolean {
    return discovered.has(projectId);
}

/** Returns the project only the first time it is found; undefined when unknown or already known. */
export function discover(projectId: string): Project | undefined {
    const project = findProject(projectId);
    if (!project || !discovered.add(projectId)) return undefined;
    return project;
}

export function resetDiscoveries() {
    discovered.clear();
}
