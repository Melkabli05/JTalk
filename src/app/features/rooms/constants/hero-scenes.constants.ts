import { DayPeriod, HeroScene, HeroSeason } from '../models/hero-scene.model';

export const HERO_PERIOD_META: Readonly<Record<DayPeriod, { greeting: string; subtitle: string }>> = {
  morning: { greeting: 'Good morning', subtitle: 'Start the day talking.' },
  afternoon: { greeting: 'Good afternoon', subtitle: 'Take a break. Talk a little.' },
  evening: { greeting: 'Good evening', subtitle: 'Wind down with a conversation.' },
  night: { greeting: 'Good night', subtitle: 'Quiet hours. Small rooms, slow talk.' },
};

export const HERO_PERIOD_SUBTITLES: Readonly<Record<DayPeriod, string>> = {
  morning: HERO_PERIOD_META.morning.subtitle,
  afternoon: HERO_PERIOD_META.afternoon.subtitle,
  evening: HERO_PERIOD_META.evening.subtitle,
  night: HERO_PERIOD_META.night.subtitle,
};

type BaseSceneTuple = readonly [id: string, src: string, alt: string];

const BASE_SCENES_BY_PERIOD: Readonly<Record<DayPeriod, readonly BaseSceneTuple[]>> = {
  morning: [
    ['morning-1', '/assets/aistudio/morning_a135c675.jpg', 'Golden sunrise framed by lakeside trees over calm misty water'],
    ['morning-2', '/assets/aistudio/morning-2_89f96d9a.jpg', 'Soft morning mist glowing over a quiet lake at sunrise'],
    ['morning-3', '/assets/aistudio/morning-3_924a2170.jpg', 'Early morning sun rising through golden fog over a forested lake'],
    ['morning-4', '/assets/aistudio/image_ae2a0458.png', 'Misty pink sunrise over a calm lake with pine treeline reflection'],
    ['morning-5', '/assets/aistudio/image_deb5993a.png', 'Golden morning sun shining through low mist over tranquil wetlands'],
    ['morning-6', '/assets/aistudio/image_a10b4c99.png', 'Fog-covered lake at dawn with glowing orange clouds above tall pines'],
  ],
  afternoon: [
    ['afternoon-1', '/assets/aistudio/afternoon_95ab713a.jpg', 'Bright afternoon sunlight sparkling across a clear blue lake'],
    ['afternoon-2', '/assets/aistudio/afternoon-2_9952f98a.jpg', 'Sunlit green trees beside calm lake water under a clear blue sky'],
    ['afternoon-3', '/assets/aistudio/afternoon-3_dd1537db.jpg', 'Shady lakeside oak and white wildflowers overlooking mountain water'],
    ['afternoon-4', '/assets/aistudio/image_c6e89141.png', 'Mountain lake with rocky peak and clouds mirrored on clear water'],
    ['afternoon-5', '/assets/aistudio/image_36379cc2.png', 'Green forested mountains beside a calm lake under blue sky and clouds'],
    ['afternoon-6', '/assets/aistudio/image_88c65136.png', 'Sunlit alpine peaks and tall pines mirrored in a tranquil mountain lake'],
  ],
  evening: [
    ['evening-1', '/assets/aistudio/evening_63b5d34c.jpg', 'Pink and coral evening sky reflected through tall lakeside pines'],
    ['evening-2', '/assets/aistudio/evening-2_33d63ddc.jpg', 'Fiery sunset clouds mirrored across a tranquil evening lake'],
    ['evening-3', '/assets/aistudio/evening-3_b983df64.jpg', 'Vibrant golden-orange dusk sky over quiet lake islands'],
    ['evening-4', '/assets/hero-lake.jpg', 'Sunset over a calm mountain lake'],
    ['evening-5', '/assets/aistudio/image_65850946.png', 'Orange sunset behind a dark treeline reflected across rippling water'],
    ['evening-6', '/assets/aistudio/image_0f621251.png', 'Dusk crescent moon above an orange horizon and dark shoreline silhouette'],
  ],
  night: [
    ['night-1', '/assets/night/night-1.jpg', 'Milky Way arching across a starry night sky over a calm lake'],
    ['night-2', '/assets/night/night-2.jpg', 'Full red moon glowing above a dark treeline and calm lake water'],
    ['night-3', '/assets/night/night-3.jpg', 'Full moon with starburst rays reflected in a quiet mountain lake'],
    ['night-4', '/assets/night/night-4.jpg', 'Milky Way core glowing above snow-capped peaks mirrored in a dark lake'],
    ['night-5', '/assets/night/night-5.jpg', 'Green aurora borealis dancing over a snowy fjord lake at night'],
    ['night-6', '/assets/night/night-6.jpg', 'Mount Fuji reflected in Lake Kawaguchi under a starry night sky'],
  ],
};

type SeasonalSceneTuple = readonly [season: HeroSeason, period: DayPeriod, alt: string];

const SEASONAL_SCENE_DEFS: readonly SeasonalSceneTuple[] = [
  ['winter', 'morning', 'Scenic morning view of a frozen mountain lake framed by snow-dusted peaks'],
  ['winter', 'afternoon', 'Bright winter afternoon across a frozen snow-covered lake in Saskatchewan'],
  ['winter', 'evening', 'Snowy shoreline and evening mountain light over Lake Tahoe'],
  ['winter', 'night', 'Serene winter night beside a quiet frozen lake under cold starlight'],
  ['spring', 'morning', 'Fresh spring green trees reflected along a calm lakeside at morning'],
  ['spring', 'afternoon', 'Tranquil spring lake mirroring a clear blue afternoon sky'],
  ['spring', 'evening', 'Calm spring lake view glowing beneath a soft pink evening sky'],
  ['spring', 'night', 'Peaceful valley lake and mountain silhouettes at night in spring'],
  ['summer', 'morning', 'Serene summer sunrise glowing over a tranquil mountain lake'],
  ['summer', 'afternoon', 'Vibrant green summer lake surrounded by dense sunlit forest trees'],
  ['summer', 'evening', 'Warm summer sunset spreading across a mountainous lakeview'],
  ['summer', 'night', 'Still mountain lake reflecting a clear starry summer night sky'],
  ['autumn', 'morning', 'Scenic autumn trees and golden morning light beside calm water'],
  ['autumn', 'afternoon', 'Scenic autumn lake view surrounded by colorful fall foliage'],
  ['autumn', 'evening', 'Wooden gazebo over a wild autumn lake glowing at sunset'],
  ['autumn', 'night', 'Leafless autumn trees silhouetted against a starry night sky'],
];

const PERIODS: readonly DayPeriod[] = ['morning', 'afternoon', 'evening', 'night'];

export const HERO_SCENES: readonly HeroScene[] = PERIODS.flatMap((period) =>
  BASE_SCENES_BY_PERIOD[period].map(([id, src, alt]) => ({
    id,
    period,
    src,
    alt,
    ...HERO_PERIOD_META[period],
  })),
);

export const SEASONAL_HERO_SCENES: readonly HeroScene[] = SEASONAL_SCENE_DEFS.map(
  ([season, period, alt]) => ({
    id: `${season}-${period}`,
    period,
    season,
    src: `/assets/seasonal/${season}-${period}.jpg`,
    alt,
    ...HERO_PERIOD_META[period],
  }),
);

const FALLBACK_HERO_SCENE: HeroScene = {
  id: 'evening-4',
  period: 'evening',
  src: '/assets/hero-lake.jpg',
  alt: 'Sunset over a calm mountain lake',
  ...HERO_PERIOD_META.evening,
};

export const DEFAULT_HERO_SCENE: HeroScene =
  HERO_SCENES.find((scene) => scene.id === 'evening-4') ?? HERO_SCENES[0] ?? FALLBACK_HERO_SCENE;
