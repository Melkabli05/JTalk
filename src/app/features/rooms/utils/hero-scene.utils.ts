import {
  DEFAULT_HERO_SCENE,
  HERO_PERIOD_SUBTITLES,
  HERO_SCENES,
  SEASONAL_HERO_SCENES,
} from '../constants/hero-scenes.constants';
import { DayPeriod, HeroScene, HeroSeason } from '../models/hero-scene.model';
import { RoomLangFilter } from '../models/room-card.model';

export function resolveDayPeriod(hour: number): DayPeriod {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  if (hour >= 18 && hour < 22) return 'evening';
  return 'night';
}

export function resolveHeroSeason(date: Date): HeroSeason {
  const month = date.getMonth();
  if (month === 11 || month <= 1) return 'winter';
  if (month <= 4) return 'spring';
  if (month <= 7) return 'summer';
  return 'autumn';
}

export function getScenesForPeriod(period: DayPeriod): readonly HeroScene[] {
  return HERO_SCENES.filter((scene) => scene.period === period);
}

export function getScenesForContext(
  period: DayPeriod,
  season: HeroSeason | null = null,
): readonly HeroScene[] {
  const base = getScenesForPeriod(period);
  if (!season) return base;
  return [
    ...base,
    ...SEASONAL_HERO_SCENES.filter((scene) => scene.season === season && scene.period === period),
  ];
}

export function selectHeroScene(date: Date, offset = 0): HeroScene {
  const pool = getScenesForContext(resolveDayPeriod(date.getHours()), resolveHeroSeason(date));
  if (pool.length === 0) return DEFAULT_HERO_SCENE;

  const dayNumber = Math.floor(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000,
  );
  const index = (((dayNumber + offset) % pool.length) + pool.length) % pool.length;
  return pool[index];
}

export function formatHeroStatusPill(
  liveCount: number,
  filter: RoomLangFilter,
  filterLabel: string,
): string {
  const scope = filter === 'all' ? 'live now' : `in ${filterLabel}`;
  if (liveCount <= 0) return `No rooms ${scope}`;
  return `${liveCount} ${liveCount === 1 ? 'room' : 'rooms'} ${scope}`;
}

export function formatHeroSubtitle(
  scene: HeroScene,
  liveCount: number,
  filter: RoomLangFilter,
  filterLabel: string,
): string {
  if (liveCount <= 0) {
    return `${formatHeroStatusPill(0, filter, filterLabel)}. Start one.`;
  }
  return scene.subtitle ?? HERO_PERIOD_SUBTITLES[scene.period];
}
