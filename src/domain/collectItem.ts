import type { ItemEntity } from '../data/MapEntity';
import type { Project } from '../data/Project';
import { projects } from '../data/projects';

export function resolveItemProject(item: ItemEntity): Project | undefined {
    if (!item.projectId) return undefined;
    return projects.find((project) => project.id === item.projectId);
}
