export type DayPeriod = 'morning' | 'afternoon' | 'evening' | 'night';

export type HeroSeason = 'winter' | 'spring' | 'summer' | 'autumn';

export interface HeroScene {
  readonly id: string;
  readonly period: DayPeriod;
  readonly src: string;
  readonly alt: string;
  readonly greeting: string;
  readonly subtitle?: string;
  readonly season?: HeroSeason;
}
