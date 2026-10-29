import type { Project, ProjectRarity } from '../data/Project';

export interface CardStyle {
    frameVariant: ProjectRarity;
    glow: boolean;
}

const rarityToCardStyle: Record<ProjectRarity, CardStyle> = {
    common: { frameVariant: 'common', glow: false },
    rare: { frameVariant: 'rare', glow: false },
    epic: { frameVariant: 'epic', glow: true },
    legendary: { frameVariant: 'legendary', glow: true },
};

export function projectToUICardStyle(project: Project): CardStyle {
    return rarityToCardStyle[project.rarity];
}
