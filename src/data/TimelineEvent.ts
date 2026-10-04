import type { CalendarDate } from './CalendarDate';

export interface TimelineEvent {
    id: string;
    title: string;
    body: string;
    date: CalendarDate;
    projectIds: string[];
}
