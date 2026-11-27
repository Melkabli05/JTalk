import { isPlatformBrowser } from '@angular/common';
import {
  computed,
  DestroyRef,
  effect,
  inject,
  linkedSignal,
  PLATFORM_ID,
  Service,
  type Signal,
  signal,
  untracked,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize, tap } from 'rxjs';
import { IdentityStore } from '../../../core/auth/identity';
import { errorMessage } from '../../../core/http/http-error.interceptor';
import { PwaService } from '../../../core/services/pwa';
import { RoomLauncher } from '../../../core/services/room-launcher';
import { ToastNotifier } from '../../../core/services/toast-notifier';
import type { VoiceRoomDto } from '../../../shared/models/voice-room.model';
import {
  type RoomLangFilter,
  ROOMS_POLL_AFTER_ATTEMPTS,
  ROOMS_POLL_INTERVAL_MS,
  ROOMS_RECONNECT_BASE_DELAY_MS,
  ROOMS_RECONNECT_POLL_DELAY_MS,
  ROOMS_SSE_FIRST_EVENT_TIMEOUT_MS,
  ROOMS_SSE_IDLE_TIMEOUT_MS,
} from '../constants/rooms.constants';
import { RoomsApi } from '../data-access/rooms-api';
import type { RoomFeedEvent } from '../models/room-feed.model';

@Service()
export class RoomsFacade {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);
  private readonly roomsApi = inject(RoomsApi);
  private readonly identity = inject(IdentityStore);
  private readonly pwa = inject(PwaService, { optional: true });
  private readonly toast = inject(ToastNotifier, { optional: true });
  private readonly router = inject(Router, { optional: true });
  private readonly roomLauncher = inject(RoomLauncher, { optional: true });

  private readonly targetLanguageState = signal<RoomLangFilter>('all');
  private readonly activeTargetLanguage = computed<string | undefined>(() => {
    const lang = this.targetLanguageState();
    return lang === 'all' ? undefined : lang;
  });

  private readonly rawRooms = linkedSignal<boolean, readonly VoiceRoomDto[] | null>({
    source: () => this.identity.isAuthenticated(),
    computation: (signedIn, previous) => (signedIn ? (previous?.value ?? null) : null),
  });
  private readonly pinnedIds = linkedSignal<boolean, readonly string[]>({
    source: () => this.identity.isAuthenticated(),
    computation: (signedIn, previous) => (signedIn ? (previous?.value ?? []) : []),
  });
  private readonly hiddenIds = linkedSignal<boolean, ReadonlySet<string>>({
    source: () => this.identity.isAuthenticated(),
    computation: (signedIn, previous) => (signedIn ? (previous?.value ?? new Set()) : new Set()),
  });
  private readonly errorState = linkedSignal<boolean, string | null>({
    source: () => this.identity.isAuthenticated(),
    computation: (signedIn, previous) => (signedIn ? (previous?.value ?? null) : null),
  });
  private readonly listLoading = signal(false);
  private readonly switchingFilterState = signal(false);
  private readonly feedActive = signal(false);
  private readonly feedRequested = signal(false);

  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectAttempts = 0;
  private feedRevision = 0;
  private wasOffline = false;

  // Bridge external ngx-sse-client Observable via rxResource so teardown is automatic.
  private readonly feedResource = rxResource({
    params: () =>
      this.canFetch() && this.feedRequested()
        ? { targetLanguage: this.activeTargetLanguage() }
        : undefined,
    equal: () => false,
    stream: ({ params }) => {
      let receivedSnapshot = false;
      const disconnected = (): void => this.handleFeedDisconnect();
      let timer = setTimeout(disconnected, ROOMS_SSE_FIRST_EVENT_TIMEOUT_MS);
      const activity = (): void => {
        if (!receivedSnapshot) return;
        clearTimeout(timer);
        timer = setTimeout(disconnected, ROOMS_SSE_IDLE_TIMEOUT_MS);
      };
      return this.roomsApi.roomFeed({ activity, disconnected }, params.targetLanguage).pipe(
        tap({
          next: (event) => {
            if (!this.canFetch() || !this.feedRequested()) return;
            if (!receivedSnapshot) {
              if (event.type !== 'SNAPSHOT') return;
              receivedSnapshot = true;
              activity();
              this.reconnectAttempts = 0;
              this.stopPollingFallback();
            }
            this.applyFeedEvent(event);
          },
          error: disconnected,
          complete: disconnected,
        }),
        finalize(() => clearTimeout(timer)),
      );
    },
  });

  readonly targetLanguage: Signal<RoomLangFilter> = this.targetLanguageState.asReadonly();
  readonly hasLoaded: Signal<boolean> = computed((): boolean => this.rawRooms() !== null);
  readonly error: Signal<string | null> = this.errorState.asReadonly();
  readonly pinnedIdsSet: Signal<ReadonlySet<string>> = computed(
    (): ReadonlySet<string> => new Set(this.pinnedIds()),
  );

  readonly loading: Signal<boolean> = computed(
    (): boolean =>
      this.listLoading() ||
      this.switchingFilterState() ||
      (this.feedRequested() && !this.hasLoaded()),
  );

  readonly rooms: Signal<readonly VoiceRoomDto[]> = computed((): readonly VoiceRoomDto[] => {
    const hidden = this.hiddenIds();
    const visible = (this.rawRooms() ?? []).filter((room) => !hidden.has(room.id));
    const pinned = this.pinnedIds();
    if (pinned.length === 0 || visible.length <= 1) return visible;
    const byId = new Map(visible.map((room) => [room.id, room]));
    const ordered: VoiceRoomDto[] = [];
    for (const id of pinned) {
      const match = byId.get(id);
      if (match) {
        ordered.push(match);
        byId.delete(id);
      }
    }
    return ordered.length === 0 ? visible : [...ordered, ...byId.values()];
  });

  readonly liveCount: Signal<number> = computed((): number => this.rooms().length);

  constructor() {
    effect(() => {
      if (isPlatformBrowser(this.platformId) && !this.identity.isAuthenticated()) {
        untracked(() => this.stopLiveFeed());
      }
    });

    effect(() => {
      const online = this.isOnline();
      if (!online) {
        this.wasOffline = true;
        untracked(() => {
          this.feedRequested.set(false);
          if (this.reconnectTimer !== null) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
          }
          this.stopPollingFallback();
        });
        return;
      }
      if (this.wasOffline) {
        this.wasOffline = false;
        untracked(() => {
          if (this.feedActive() && this.canFetch()) {
            this.reconnectAttempts = 0;
            this.errorState.set(null);
            if (this.reconnectTimer !== null) {
              clearTimeout(this.reconnectTimer);
              this.reconnectTimer = null;
            }
            this.stopPollingFallback();
            this.feedRequested.set(true);
          }
        });
      }
    });

    this.destroyRef.onDestroy(() => this.stopLiveFeed());
  }

  ensureLoaded(): void {
    if (!this.canFetch() || this.feedActive()) return;
    this.feedRevision++;
    this.feedActive.set(true);
    this.errorState.set(null);
    if (this.isOnline()) {
      this.feedRequested.set(true);
    }
  }

  setTargetLanguage(filter: RoomLangFilter, route?: ActivatedRoute): void {
    if (filter !== this.targetLanguageState()) {
      this.targetLanguageState.set(filter);
      this.feedRevision++;
      this.errorState.set(null);
      if (this.feedActive()) {
        this.switchingFilterState.set(true);
        this.reconnectAttempts = 0;
        if (this.reconnectTimer !== null) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
        this.stopPollingFallback();
        if (this.isOnline()) {
          this.feedRequested.set(true);
        } else {
          this.switchingFilterState.set(false);
        }
      }
    }
    if (route && this.router) {
      void this.router.navigate([], {
        relativeTo: route,
        queryParams: { lang: filter === 'all' ? null : filter },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }
  }

  refresh(onDone?: (ok: boolean) => void): void {
    if (!this.canFetch()) {
      onDone?.(false);
      return;
    }
    this.hiddenIds.set(new Set());
    this.loadRoomsList(true, (ok) => {
      if (ok && !onDone) {
        this.toast?.show('Rooms updated.');
      }
      onDone?.(ok);
    });
  }

  startRoom(destroyRef?: DestroyRef): void {
    this.roomLauncher?.openStartRoom(destroyRef ?? this.destroyRef);
  }

  joinRoom(roomId: string): void {
    void this.router?.navigate(['/room', roomId]);
  }

  pinRoom(roomId: string): void {
    if (this.pinnedIds().includes(roomId)) {
      this.pinnedIds.update((list): readonly string[] => list.filter((id) => id !== roomId));
      this.toast?.show('Unpinned.');
      return;
    }
    this.pinnedIds.update((list): readonly string[] => [
      roomId,
      ...list.filter((id) => id !== roomId),
    ]);
    this.toast?.show('Pinned to top.');
  }

  hideRoom(roomId: string): void {
    this.hiddenIds.update((prev): ReadonlySet<string> => new Set(prev).add(roomId));
    if (typeof this.toast?.showAction === 'function') {
      this.toast.showAction('Hidden from list.', 'Undo', () => this.unhideRoom(roomId));
    } else {
      this.toast?.show('Hidden from list.');
    }
  }

  unhideRoom(roomId: string): void {
    this.hiddenIds.update((prev): ReadonlySet<string> => {
      const next = new Set(prev);
      next.delete(roomId);
      return next;
    });
  }

  applyFeedEvent(event: RoomFeedEvent): void {
    this.feedRevision++;
    switch (event.type) {
      case 'SNAPSHOT':
        this.rawRooms.set(event.rooms);
        this.switchingFilterState.set(false);
        this.errorState.set(null);
        return;
      case 'ROOM_OPENED':
        this.rawRooms.update((list): readonly VoiceRoomDto[] => [
          event.room,
          ...(list ?? []).filter((room) => room.id !== event.room.id),
        ]);
        return;
      case 'ROOM_UPDATED':
        this.rawRooms.update((list): readonly VoiceRoomDto[] => {
          const current = list ?? [];
          return current.some((room) => room.id === event.room.id)
            ? current.map((room) => (room.id === event.room.id ? event.room : room))
            : [event.room, ...current];
        });
        return;
      case 'ROOM_CLOSED':
        this.rawRooms.update((list): readonly VoiceRoomDto[] =>
          (list ?? []).filter((room) => room.id !== event.roomId),
        );
        return;
      case 'ROOM_STATS':
        this.rawRooms.update((list): readonly VoiceRoomDto[] =>
          (list ?? []).map((room) =>
            room.id === event.roomId
              ? {
                  ...room,
                  speakers: event.live.speakers,
                  participantCount: event.live.participantCount,
                  handRaiseCount: event.live.handRaiseCount,
                  ...(event.speakerProfiles ? { speakerProfiles: event.speakerProfiles } : {}),
                }
              : room,
          ),
        );
    }
  }

  private isOnline(): boolean {
    return this.pwa?.isOnline() ?? true;
  }

  private canFetch(): boolean {
    return isPlatformBrowser(this.platformId) && this.identity.isAuthenticated();
  }

  private handleFeedDisconnect(): void {
    if (!this.feedRequested() || !this.canFetch()) return;

    this.feedRequested.set(false);
    this.switchingFilterState.set(false);
    if (!this.isOnline()) return;

    this.reconnectAttempts++;
    this.loadRoomsList(false);

    const polling = this.reconnectAttempts >= ROOMS_POLL_AFTER_ATTEMPTS;
    if (polling) this.startPollingFallback();

    const delayMs = polling
      ? ROOMS_RECONNECT_POLL_DELAY_MS
      : ROOMS_RECONNECT_BASE_DELAY_MS * 2 ** (this.reconnectAttempts - 1);
    if (this.reconnectTimer !== null) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      if (this.feedActive() && this.canFetch() && this.isOnline()) this.feedRequested.set(true);
    }, delayMs);
  }

  private loadRoomsList(ensureFeed: boolean, onDone?: (ok: boolean) => void): void {
    if (this.listLoading() || !this.canFetch()) {
      onDone?.(false);
      return;
    }
    const revision = this.feedRevision;
    const targetLanguage = this.activeTargetLanguage();
    this.listLoading.set(true);
    this.errorState.set(null);
    this.roomsApi
      .listRooms(targetLanguage)
      .pipe(finalize(() => this.listLoading.set(false)))
      .subscribe({
        next: (rooms) => {
          if (!this.identity.isAuthenticated() || revision !== this.feedRevision) {
            onDone?.(false);
            return;
          }
          this.rawRooms.set(rooms);
          this.switchingFilterState.set(false);
          if (ensureFeed) this.ensureLoaded();
          onDone?.(true);
        },
        error: (err: unknown) => {
          if (this.identity.isAuthenticated() && revision === this.feedRevision) {
            this.switchingFilterState.set(false);
            this.errorState.set(errorMessage(err, 'Could not load live rooms right now.'));
          }
          onDone?.(false);
        },
      });
  }

  private startPollingFallback(): void {
    if (this.pollTimer !== null) return;
    this.pollTimer = setInterval(() => {
      if (this.feedActive() && this.identity.isAuthenticated() && this.isOnline()) {
        this.loadRoomsList(false);
      }
    }, ROOMS_POLL_INTERVAL_MS);
  }

  private stopPollingFallback(): void {
    if (this.pollTimer !== null) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private stopLiveFeed(): void {
    this.feedActive.set(false);
    this.feedRequested.set(false);
    this.switchingFilterState.set(false);
    this.feedRevision++;
    this.reconnectAttempts = 0;
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.stopPollingFallback();
  }
}
