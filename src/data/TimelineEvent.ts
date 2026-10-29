import type { CalendarDate } from './CalendarDate';
import type { LocalizedText } from './locale';

export interface TimelineEvent {
    id: string;
    title: LocalizedText;
    body: LocalizedText;
    date: CalendarDate;
    projectIds: string[];
}
