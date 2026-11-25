import { ProfileTab } from '../../../core/models/session.model';
import { PresetAvatarMeta } from '../models/profile.model';

export const PROFILE_TAB_ORDER: readonly ProfileTab[] = ['overview', 'edit', 'account'];
export const PROFILE_CONNECTIONS_PAGE_SIZE = 30;

export const PRESET_AVATARS: readonly PresetAvatarMeta[] = [
  { id: 'preset-1', label: 'Avatar 1', bg: '#2F80ED', extra: false },
  { id: 'preset-2', label: 'Avatar 2', bg: '#F6C445', extra: false },
  { id: 'preset-3', label: 'Avatar 3', bg: '#2F80ED', extra: false },
  { id: 'preset-4', label: 'Avatar 4', bg: '#F6C445', extra: false },
  { id: 'preset-5', label: 'Avatar 5', bg: '#2F80ED', extra: false },
  { id: 'preset-6', label: 'Avatar 6', bg: '#F6C445', extra: true },
  { id: 'preset-7', label: 'Avatar 7', bg: '#2F80ED', extra: true },
  { id: 'preset-8', label: 'Avatar 8', bg: '#F6C445', extra: true },
  { id: 'preset-9', label: 'Avatar 9', bg: '#2F80ED', extra: true },
  { id: 'preset-10', label: 'Avatar 10', bg: '#F6C445', extra: true },
];

export const PROFILE_SPEAK_OPTIONS: readonly string[] = [
  'Arabic',
  'English',
  'French',
  'Spanish',
  'Japanese',
  'German',
  'Portuguese',
  'Korean',
  'Italian',
];

export const PROFILE_LEARN_OPTIONS: readonly string[] = [
  'Not set',
  'English',
  'French',
  'Arabic',
  'Spanish',
  'Japanese',
  'German',
  'Portuguese',
  'Korean',
  'Italian',
];

export const PROFILE_LOCATION_OPTIONS: readonly string[] = [
  'Not set',
  'Morocco',
  'Spain',
  'France',
  'United Kingdom',
  'United States',
  'Japan',
  'Germany',
  'Canada',
  'Brazil',
  'South Korea',
  'Italy',
  'Mexico',
  'Egypt',
];
