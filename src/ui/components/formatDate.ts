import type { CalendarDate } from '../../data/CalendarDate';

export const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
] as const;

/** `month` is 1-based, as authored in the data files. */
export const monthName = (month: number) => MONTH_NAMES[month - 1] ?? `Month ${month}`;

export const formatDate = (date: CalendarDate) => `${monthName(date.month)} ${date.year}`;
