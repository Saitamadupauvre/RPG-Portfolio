import type { BookImage } from './BookPage';
import type { CalendarDate } from './CalendarDate';
import type { LocalizedText } from './locale';

export type ProjectRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface Project {
    id: string;
    /** A name, the same in every language. */
    title: string;
    /** Paragraphs separated by a blank line (`\n\n`). */
    description: LocalizedText;
    tags: string[];
    links: {
        repo?: string;
        demo?: string;
        channel?: string;
    };
    rarity: ProjectRarity;
    date?: CalendarDate;
    /** Still being worked on: the page says so next to the date. */
    inProgress?: boolean;
    image?: BookImage;
}
