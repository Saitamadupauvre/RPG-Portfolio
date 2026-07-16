export type ProjectRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface Project {
    id: string;
    title: string;
    description: string;
    tags: string[];
    links: {
        repo?: string;
        demo?: string;
    };
    rarity: ProjectRarity;
}
