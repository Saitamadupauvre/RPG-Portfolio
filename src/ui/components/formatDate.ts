import type { CalendarDate } from '../../data/CalendarDate';
import { currentLocale } from '../../domain/i18n';

// UTC on both ends: a local midnight could fall on the previous month west of Greenwich.
const toDate = (year: number, month: number) => new Date(Date.UTC(year, month - 1, 1));

/** `month` is 1-based, as authored in the data files. "September", "septembre". */
export const monthName = (month: number) =>
    new Intl.DateTimeFormat(currentLocale(), { month: 'long', timeZone: 'UTC' }).format(toDate(2000, month));

/** "September 2026", "septembre 2026": the browser knows every language's month names. */
export const formatDate = (date: CalendarDate) =>
    new Intl.DateTimeFormat(currentLocale(), { month: 'long', year: 'numeric', timeZone: 'UTC' })
        .format(toDate(date.year, date.month));
