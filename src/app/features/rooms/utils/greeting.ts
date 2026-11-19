import { msg } from '@shared/utils/i18n/msg';

/** The greeting for each part of the day, without and with a name. */
export const GREETINGS = {
  morning: [msg('Good morning'), msg('Good morning, {name}')],
  afternoon: [msg('Good afternoon'), msg('Good afternoon, {name}')],
  evening: [msg('Good evening'), msg('Good evening, {name}')],
} as const;

/** The part of the day an hour belongs to: before noon, before six, and after. */
export function partOfDay(hour: number): keyof typeof GREETINGS {
  return hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
}
