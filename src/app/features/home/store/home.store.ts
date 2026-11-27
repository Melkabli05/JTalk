import { computed, DestroyRef, inject, Service, signal } from '@angular/core';
import { AppStore } from '../../../core/store/app.store';
import { languageLabelFor } from '../../../core/utils/language-codes';
import type { VoiceRoomDto } from '../../../shared/models/voice-room.model';
import { RoomsStore } from '../../rooms/store/rooms.store';

export interface HomeGreeting {
  readonly text: string;
  readonly lang: string;
  readonly dir?: 'ltr' | 'rtl';
}

const HOME_GREETINGS: readonly [HomeGreeting, ...HomeGreeting[]] = [
  { text: 'Hola', lang: 'es', dir: 'ltr' },
  { text: 'Hello', lang: 'en', dir: 'ltr' },
  { text: 'مرحبا', lang: 'ar', dir: 'rtl' },
  { text: 'こんにちは', lang: 'ja', dir: 'ltr' },
  { text: 'Bonjour', lang: 'fr', dir: 'ltr' },
  { text: 'Ciao', lang: 'it', dir: 'ltr' },
];

/**
 * Home feature store: manages the landing greeting cycle, live room preview strip,
 * and exposes global auth/theme/active-room state via {@link AppStore}.
 */
@Service({ autoProvided: false })
export class HomeStore {
  private readonly app = inject(AppStore);
  private readonly roomsStore = inject(RoomsStore);

  readonly greetings = HOME_GREETINGS;
  readonly greetingIndex = signal(1);
  readonly selectedRoomIndex = signal(0);
  readonly autoCyclePaused = signal(false);

  readonly isAuthenticated = this.app.isAuthenticated;
  readonly isAuthLoading = this.app.isAuthLoading;
  readonly isDark = this.app.isDark;
  readonly activeRoomId = this.app.activeRoomId;
  readonly rooms = this.roomsStore.rooms;

  readonly activeGreeting = computed(
    () => this.greetings[this.greetingIndex()] ?? this.greetings[0],
  );

  readonly liveSummary = computed(() => {
    if (!this.isAuthenticated()) return 'Drop-in voice rooms';
    const count = this.roomsStore.liveCount();
    if (count <= 0) return 'Start the first room';
    return count === 1 ? '1 open now' : `${count} open now`;
  });

  readonly selectedRoom = computed<VoiceRoomDto | null>(() => {
    const list = this.rooms();
    if (list.length === 0) return null;
    const idx = this.selectedRoomIndex() % list.length;
    return list[idx] ?? list[0] ?? null;
  });

  readonly selectedRoomMeta = computed(() => {
    const room = this.selectedRoom();
    if (!room) return '';
    return `${languageLabelFor(room.targetLanguage)} · ${room.speakers.length} speaking · ${room.participantCount} participant${room.participantCount === 1 ? '' : 's'} · ${room.maxStageSeats} seats`;
  });

  readonly activeCounterLabel = computed(() => {
    const total = this.rooms().length;
    if (total === 0) return '00 / 00';
    const current = (this.selectedRoomIndex() % total) + 1;
    return `${String(current).padStart(2, '0')} / ${String(total).padStart(2, '0')}`;
  });

  cycleGreeting(): void {
    this.greetingIndex.update((i) => (i + 1) % this.greetings.length);
  }

  cycleRoom(manual = true): boolean {
    const total = this.rooms().length;
    if (total < 2) return false;
    if (manual) {
      this.autoCyclePaused.set(true);
    }
    this.selectedRoomIndex.update((i) => (i + 1) % total);
    return true;
  }

  setAutoCyclePaused(paused: boolean): void {
    this.autoCyclePaused.set(paused);
  }

  toggleTheme(): void {
    this.app.toggleTheme();
  }

  openStartRoom(destroyRef: DestroyRef): void {
    this.app.openStartRoom(destroyRef);
  }
}
