const GREETINGS = {
  morning: 'Good morning',
  afternoon: 'Good afternoon',
  evening: 'Good evening',
  night: 'Hello',
} as const;

export function partOfDay(hour: number): keyof typeof GREETINGS {
  if (hour >= 22 || hour < 5) {
    return 'night';
  }
  return hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
}

/** "Good morning, Mona" at the person's time of day, or just "Good morning" until their name is known. */
export function greetingFor(hour: number, name: string): string {
  const greeting = GREETINGS[partOfDay(hour)];
  return name ? `${greeting}, ${name}` : greeting;
}
