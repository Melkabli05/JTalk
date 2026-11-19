import { msg } from '@shared/utils/i18n/msg';

/** The greeting for each part of the day, without and with a name. */
export const GREETINGS = {
  morning: [msg('Good morning'), msg('Good morning, {name}')],
  afternoon: [msg('Good afternoon'), msg('Good afternoon, {name}')],
  evening: [msg('Good evening'), msg('Good evening, {name}')],
  // The small hours: neither a good morning yet nor a good evening any more.
  night: [msg('Hello'), msg('Hello, {name}')],
} as const;

/** The part of the day an hour belongs to: morning from 5, afternoon from noon, evening from 6 pm, night from 10 pm to 5 am. */
export function partOfDay(hour: number): keyof typeof GREETINGS {
  if (hour >= 5 && hour < 12) {
    return 'morning';
  }
  if (hour >= 12 && hour < 18) {
    return 'afternoon';
  }
  return hour >= 18 && hour < 22 ? 'evening' : 'night';
}
