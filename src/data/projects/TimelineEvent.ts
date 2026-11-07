import type { CalendarDate } from './CalendarDate';
import type { LocalizedText } from '@data/i18n/locale';

export interface TimelineEvent {
    id: string;
    title: LocalizedText;
    body: LocalizedText;
    date: CalendarDate;
    projectIds: string[];
}
