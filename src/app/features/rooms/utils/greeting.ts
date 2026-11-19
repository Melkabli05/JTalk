import { msg } from '@shared/utils/i18n/msg';

/** The greeting for each part of the day, without and with a name. */
export const GREETINGS = {
  morning: [msg('Good morning'), msg('Good morning, {name}')],
  afternoon: [msg('Good afternoon'), msg('Good afternoon, {name}')],
  evening: [msg('Good evening'), msg('Good evening, {name}')],
  night: [msg('Hello'), msg('Hello, {name}')],
} as const;

export function partOfDay(hour: number): keyof typeof GREETINGS {
  if (hour >= 22 || hour < 5) {
    return 'night';
  }
  return hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
}
