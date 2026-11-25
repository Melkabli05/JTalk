import {
  HERO_PERIOD_SUBTITLES,
  HERO_SCENES,
  SEASONAL_HERO_SCENES,
} from '../constants/hero-scenes.constants';
import {
  formatHeroStatusPill,
  formatHeroSubtitle,
  getScenesForContext,
  getScenesForPeriod,
  resolveDayPeriod,
  resolveHeroSeason,
  selectHeroScene,
} from './hero-scene.utils';

describe('hero-scene.utils', () => {
  it('resolves morning, afternoon, evening, and night day periods across all 24 hours', () => {
    expect(resolveDayPeriod(5)).toBe('morning');
    expect(resolveDayPeriod(11)).toBe('morning');
    expect(resolveDayPeriod(12)).toBe('afternoon');
    expect(resolveDayPeriod(17)).toBe('afternoon');
    expect(resolveDayPeriod(18)).toBe('evening');
    expect(resolveDayPeriod(21)).toBe('evening');
    expect(resolveDayPeriod(22)).toBe('night');
    expect(resolveDayPeriod(23)).toBe('night');
    expect(resolveDayPeriod(0)).toBe('night');
    expect(resolveDayPeriod(4)).toBe('night');
  });

  it('includes all 24 local scenes grouped evenly with 6 per period and period subtitles', () => {
    expect(HERO_SCENES.length).toBe(24);
    expect(getScenesForPeriod('morning').length).toBe(6);
    expect(getScenesForPeriod('afternoon').length).toBe(6);
    expect(getScenesForPeriod('evening').length).toBe(6);
    expect(getScenesForPeriod('night').length).toBe(6);

    expect(HERO_PERIOD_SUBTITLES.morning).toBe('Start the day talking.');
    expect(HERO_PERIOD_SUBTITLES.afternoon).toBe('Take a break. Talk a little.');
    expect(HERO_PERIOD_SUBTITLES.evening).toBe('Wind down with a conversation.');
    expect(HERO_PERIOD_SUBTITLES.night).toBe('Quiet hours. Small rooms, slow talk.');
  });

  it('selects period-appropriate scenes and runs a deterministic 7-day cycle in season', () => {
    const morningDate = new Date(2026, 10, 21, 9, 30);
    const afternoonDate = new Date(2026, 10, 21, 14, 15);
    const eveningDate = new Date(2026, 10, 21, 20, 0);
    const nightDate = new Date(2026, 10, 21, 23, 15);

    // Offset cycle visits all 7 scenes (6 daily + 1 autumn seasonal) and wraps on day 7
    const morningIds = Array.from({ length: 7 }, (_, i) => selectHeroScene(morningDate, i).id);
    expect(new Set(morningIds).size).toBe(7);
    expect(morningIds).toContain('autumn-morning');
    expect(selectHeroScene(morningDate, 7).id).toBe(morningIds[0]);
    expect(selectHeroScene(morningDate, 0).greeting).toBe('Good morning');
    expect(selectHeroScene(morningDate, 0).subtitle).toBe('Start the day talking.');

    // Consecutive calendar days also walk all 7 scenes cleanly without repeats
    const sevenDaysMorning = Array.from(
      { length: 7 },
      (_, d) => selectHeroScene(new Date(2026, 9, 10 + d, 9, 0), 0).id,
    );
    expect(new Set(sevenDaysMorning).size).toBe(7);
    expect(sevenDaysMorning).toContain('autumn-morning');
    expect(selectHeroScene(new Date(2026, 9, 17, 9, 0), 0).id).toBe(sevenDaysMorning[0]);

    const a0 = selectHeroScene(afternoonDate, 0);
    expect(a0.period).toBe('afternoon');
    expect(a0.greeting).toBe('Good afternoon');
    expect(a0.subtitle).toBe('Take a break. Talk a little.');

    const e0 = selectHeroScene(eveningDate, 0);
    expect(e0.period).toBe('evening');
    expect(e0.greeting).toBe('Good evening');
    expect(e0.subtitle).toBe('Wind down with a conversation.');

    const nightIds = Array.from({ length: 7 }, (_, i) => selectHeroScene(nightDate, i).id);
    expect(new Set(nightIds).size).toBe(7);
    expect(nightIds).toContain('autumn-night');
    expect(selectHeroScene(nightDate, 7).id).toBe(nightIds[0]);
    expect(selectHeroScene(nightDate, 0).period).toBe('night');
    expect(selectHeroScene(nightDate, 0).greeting).toBe('Good night');
    expect(selectHeroScene(nightDate, 0).subtitle).toBe('Quiet hours. Small rooms, slow talk.');
  });

  it('includes 16 seasonal scenes (one per period per season) joining the 7-day cycle in season', () => {
    expect(SEASONAL_HERO_SCENES.length).toBe(16);
    expect(new Set(SEASONAL_HERO_SCENES.map((s) => s.src)).size).toBe(16);

    // Season month mapping (Dec-Feb winter, Mar-May spring, Jun-Aug summer, Sep-Nov autumn)
    expect(resolveHeroSeason(new Date(2026, 11, 15, 9, 0))).toBe('winter');
    expect(resolveHeroSeason(new Date(2026, 0, 15, 14, 0))).toBe('winter');
    expect(resolveHeroSeason(new Date(2026, 1, 15, 20, 0))).toBe('winter');
    expect(resolveHeroSeason(new Date(2026, 3, 15, 9, 0))).toBe('spring');
    expect(resolveHeroSeason(new Date(2026, 6, 15, 14, 0))).toBe('summer');
    expect(resolveHeroSeason(new Date(2026, 9, 15, 9, 0))).toBe('autumn');

    // Without season -> 6 base photos; in season -> 7 photos (6 base + 1 seasonal)
    expect(getScenesForContext('morning', null).length).toBe(6);
    for (const season of ['winter', 'spring', 'summer', 'autumn'] as const) {
      for (const period of ['morning', 'afternoon', 'evening', 'night'] as const) {
        const pool = getScenesForContext(period, season);
        expect(pool.length).toBe(7);
        const seasonalEntries = pool.filter((s) => s.season === season);
        expect(seasonalEntries.length).toBe(1);
        expect(seasonalEntries[0].id).toBe(`${season}-${period}`);
        expect(seasonalEntries[0].src).toBe(`/assets/seasonal/${season}-${period}.jpg`);
      }
    }

    // Verify January 7-day cycle includes winter snow photos and October includes autumn photos
    const janAfternoonWeek = Array.from(
      { length: 7 },
      (_, d) => selectHeroScene(new Date(2026, 0, 10 + d, 14, 0), 0).id,
    );
    expect(janAfternoonWeek).toContain('winter-afternoon');

    const octEveningWeek = Array.from(
      { length: 7 },
      (_, d) => selectHeroScene(new Date(2026, 9, 10 + d, 20, 0), 0).id,
    );
    expect(octEveningWeek).toContain('autumn-evening');
  });

  it('formats status pills and subtitles for active language filters and empty live states', () => {
    const morningScene = selectHeroScene(new Date(2026, 10, 21, 9, 0), 0);

    expect(formatHeroStatusPill(4, 'all', 'All')).toBe('4 rooms live now');
    expect(formatHeroStatusPill(1, 'all', 'All')).toBe('1 room live now');
    expect(formatHeroStatusPill(0, 'all', 'All')).toBe('No rooms live now');

    expect(formatHeroStatusPill(2, 'fr', 'French')).toBe('2 rooms in French');
    expect(formatHeroStatusPill(1, 'en', 'English')).toBe('1 room in English');
    expect(formatHeroStatusPill(0, 'ja', 'Japanese')).toBe('No rooms in Japanese');

    expect(formatHeroSubtitle(morningScene, 4, 'all', 'All')).toBe('Start the day talking.');
    expect(formatHeroSubtitle(morningScene, 0, 'all', 'All')).toBe('No rooms live now. Start one.');
    expect(formatHeroSubtitle(morningScene, 0, 'fr', 'French')).toBe(
      'No rooms in French. Start one.',
    );
  });
});

