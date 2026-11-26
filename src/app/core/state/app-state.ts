import { isPlatformBrowser } from '@angular/common';
import { computed, inject, linkedSignal, PLATFORM_ID, Service, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  ACTIVE_ROOM_STORAGE_KEY,
  COLOR_SCHEME_STORAGE_KEY,
} from '../../shared/constants/storage-keys.constants';
import { IdentityStore } from '../auth/identity';
import {
  AppView,
  AvatarSelection,
  ProfileTab,
  UserProfile,
} from '../models/session.model';
import { countryNameFor, languageNameFor } from '../utils/language-codes';
import { sanitizeAvatarUrl } from '../utils/safe-url';

function resolveViewFromUrl(url: string): AppView {
  const path = url.split('?')[0].split('#')[0].replace(/^\/+/, '');
  const firstSegment = path.split('/')[0] ?? '';
  return firstSegment === 'room' || firstSegment === 'people' || firstSegment === 'profile'
    ? firstSegment
    : 'rooms';
}

function formatJoinedMonth(isoDate: string | undefined): string {
  if (!isoDate) return '';
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function resolveAvatarSelection(avatarUrl: string | null | undefined): AvatarSelection {
  const safeUrl = sanitizeAvatarUrl(avatarUrl);
  if (safeUrl && safeUrl.startsWith('/avatars/')) {
    const id = safeUrl.replace('/avatars/', '').replace(/\.[^.]+$/, '');
    return { kind: 'preset', id, bg: '#16121F', label: id, imageUrl: safeUrl };
  }
  return { kind: 'own', id: 'own', bg: '#16121F', label: 'Your picture', imageUrl: safeUrl };
}

@Service()
export class AppState {
  private readonly router = inject(Router);
  private readonly identity = inject(IdentityStore);
  private readonly platformId = inject(PLATFORM_ID);

  private readonly currentUrl = computed(() => {
    const finalUrl = this.router.lastSuccessfulNavigation()?.finalUrl;
    return finalUrl ? this.router.serializeUrl(finalUrl) : this.router.url;
  });

  readonly activeView = computed<AppView>(() => resolveViewFromUrl(this.currentUrl()));
  readonly colorScheme = signal<'light' | 'dark' | 'system'>('system');
  readonly requestedProfileTab = signal<ProfileTab>('overview');
  readonly focusStageTick = signal(0);

  private readonly rememberedRoom = linkedSignal<boolean, string | null>({
    source: () => this.identity.isAuthenticated(),
    computation: (signedIn, previous) =>
      signedIn ? (previous?.value ?? this.readStoredActiveRoomId()) : null,
  });
  readonly resumeRoomId = this.rememberedRoom.asReadonly();

  readonly profile = computed<UserProfile>(() => {
    const me = this.identity.me();
    const stats = this.identity.socialStats();

    if (me) {
      const learningCode = me.learningLanguages[0]?.languageCode;
      return {
        id: me.id,
        name: me.displayName,
        username: me.username,
        avatar: resolveAvatarSelection(me.avatarUrl),
        speak: languageNameFor(me.nativeLanguage),
        learn: learningCode ? languageNameFor(learningCode) : 'Not set',
        location: me.countryCode ? countryNameFor(me.countryCode) : 'Not set',
        about: me.bio ?? '',
        joined: formatJoinedMonth(me.createdAt),
        followers: stats?.followerCount ?? 0,
        following: stats?.followingCount ?? 0,
      };
    }

    return {
      id: this.identity.userId() ?? undefined,
      name: 'Speaker',
      username: '',
      avatar: resolveAvatarSelection(null),
      speak: 'English',
      learn: 'Spanish',
      location: 'Not set',
      about: '',
      joined: '',
      followers: 0,
      following: 0,
    };
  });

  constructor() {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      const saved = localStorage.getItem(COLOR_SCHEME_STORAGE_KEY);
      if (saved === 'light' || saved === 'dark') this.setColorScheme(saved);
    } catch { /* Storage may be unavailable. */ }
  }

  setColorScheme(scheme: string): void {
    if (scheme !== 'light' && scheme !== 'dark' && scheme !== 'system') return;
    this.colorScheme.set(scheme);
    if (!isPlatformBrowser(this.platformId)) return;
    document.documentElement.style.colorScheme = scheme === 'system' ? '' : scheme;
    try { localStorage.setItem(COLOR_SCHEME_STORAGE_KEY, scheme); } catch { /* Apply for this session. */ }
  }

  rememberRoom(roomId: string | null): void {
    this.rememberedRoom.set(roomId);
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      if (roomId) window.sessionStorage.setItem(ACTIVE_ROOM_STORAGE_KEY, roomId);
      else window.sessionStorage.removeItem(ACTIVE_ROOM_STORAGE_KEY);
    } catch { /* Ignore storage restrictions. */ }
  }

  requestProfileTab(tab: ProfileTab): void {
    this.requestedProfileTab.set(tab);
  }

  triggerStageFocus(): void {
    this.focusStageTick.update((n) => n + 1);
  }

  private readStoredActiveRoomId(): string | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    try {
      return window.sessionStorage.getItem(ACTIVE_ROOM_STORAGE_KEY);
    } catch {
      return null;
    }
  }
}
