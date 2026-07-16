import type { Project, ProjectRarity } from '../data/Project';

export interface CardStyle {
    frameVariant: ProjectRarity;
    badgeLabel: string;
    glow: boolean;
}

const rarityToCardStyle: Record<ProjectRarity, CardStyle> = {
    common: { frameVariant: 'common', badgeLabel: 'COMMON', glow: false },
    rare: { frameVariant: 'rare', badgeLabel: 'RARE', glow: false },
    epic: { frameVariant: 'epic', badgeLabel: 'EPIC', glow: true },
    legendary: { frameVariant: 'legendary', badgeLabel: 'LEGENDARY', glow: true },
};

export function projectToUICardStyle(project: Project): CardStyle {
    return rarityToCardStyle[project.rarity];
}
