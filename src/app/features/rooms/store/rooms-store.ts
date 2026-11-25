import { isPlatformBrowser } from '@angular/common';
import {
  computed,
  DestroyRef,
  effect,
  inject,
  linkedSignal,
  PLATFORM_ID,
  Service,
  signal,
  untracked,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { finalize, tap } from 'rxjs';
import { IdentityStore } from '../../../core/auth/identity';
import { errorMessage } from '../../../core/http/http-error.interceptor';
import { VoiceRoomDto } from '../../../shared/models/voice-room.model';
import {
  LANGUAGE_FILTER_CHIPS,
  ROOM_CARD_AVATAR_LIMIT,
  ROOMS_LIST_TIMEOUT_MS,
  ROOMS_POLL_AFTER_ATTEMPTS,
  ROOMS_POLL_INTERVAL_MS,
  ROOMS_RECONNECT_BASE_DELAY_MS,
  ROOMS_RECONNECT_POLL_DELAY_MS,
  ROOMS_SSE_FIRST_EVENT_TIMEOUT_MS,
  ROOMS_SSE_IDLE_TIMEOUT_MS,
} from '../constants/rooms.constants';
import { RoomsApi } from '../data-access/rooms-api';
import { LiveRoomCard, RoomLangFilter } from '../models/room-card.model';
import { RoomFeedEvent } from '../models/room-feed.model';
import {
  filterRoomsByLanguage,
  orderPinnedRooms,
  toLiveRoomCard,
} from '../utils/rooms-filter';

interface ListRequest {
  readonly revision: number;
  readonly notify: boolean;
}

@Service()
export class RoomsStore {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);
  private readonly roomsApi = inject(RoomsApi);
  private readonly identity = inject(IdentityStore);

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
  private readonly listRequest = linkedSignal<boolean, ListRequest | null>({
    source: () => this.identity.isAuthenticated(),
    computation: (signedIn, previous) => (signedIn ? (previous?.value ?? null) : null),
  });
  private readonly feedActive = signal(false);
  private readonly feedRequested = signal(false);
  private readonly refreshTickState = signal(0);

  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectAttempts = 0;
  private feedRevision = 0;

  private readonly listResource = this.roomsApi.listRoomsResource(
    () => this.canFetch() && this.listRequest() !== null,
  );

  // Bridge external ngx-sse-client Observable via rxResource so teardown is automatic.
  private readonly feedResource = rxResource({
    params: () => (this.canFetch() && this.feedRequested() ? true : undefined),
    equal: () => false,
    stream: () => {
      let receivedSnapshot = false;
      const disconnected = () => this.handleFeedDisconnect();
      let timer = setTimeout(disconnected, ROOMS_SSE_FIRST_EVENT_TIMEOUT_MS);
      const activity = () => {
        if (!receivedSnapshot) return;
        clearTimeout(timer);
        timer = setTimeout(disconnected, ROOMS_SSE_IDLE_TIMEOUT_MS);
      };
      return this.roomsApi.roomFeed({ activity, disconnected }).pipe(
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

  readonly selectedFilter = signal<RoomLangFilter>('all');
  readonly filterChips = LANGUAGE_FILTER_CHIPS;
  readonly hasLoaded = computed(() => this.rawRooms() !== null);
  readonly refreshTick = this.refreshTickState.asReadonly();
  readonly error = linkedSignal<boolean, string | null>({
    source: () => this.identity.isAuthenticated(),
    computation: (signedIn, previous) => (signedIn ? (previous?.value ?? null) : null),
  });

  readonly loading = computed(
    () => this.listRequest() !== null || (this.feedRequested() && !this.hasLoaded()),
  );

  readonly rooms = computed<readonly LiveRoomCard[]>(() => {
    const directory = this.identity.userDirectory();
    const hidden = this.hiddenIds();
    const visible = (this.rawRooms() ?? [])
      .filter((room) => !hidden.has(room.id))
      .map((room) => toLiveRoomCard(room, directory));
    return orderPinnedRooms(visible, this.pinnedIds());
  });

  readonly liveCount = computed(() => this.rooms().length);
  readonly filteredRooms = computed(() =>
    filterRoomsByLanguage(this.rooms(), this.selectedFilter()),
  );
  readonly activeFilterLabel = computed(
    () => this.filterChips.find((c) => c.value === this.selectedFilter())?.label ?? 'All languages',
  );

  constructor() {
    effect(() => {
      if (isPlatformBrowser(this.platformId) && !this.identity.isAuthenticated()) {
        untracked(() => this.stopLiveFeed());
      }
    });

    effect((onCleanup) => {
      const request = this.listRequest();
      if (!request) return;
      const status = this.listResource.status();
      if (status === 'loading') {
        const timer = setTimeout(() => this.finishList(request), ROOMS_LIST_TIMEOUT_MS);
        onCleanup(() => clearTimeout(timer));
      } else if (status === 'resolved' || status === 'error') {
        const rooms = status === 'resolved' ? this.listResource.value() : undefined;
        const error = this.listResource.error();
        untracked(() => this.finishList(request, rooms, error));
      }
    });

    this.destroyRef.onDestroy(() => this.stopLiveFeed());
  }

  ensureLoaded(): void {
    if (!this.canFetch() || this.feedActive()) return;
    this.feedRevision++;
    this.feedActive.set(true);
    this.error.set(null);
    this.feedRequested.set(true);
  }

  refresh(): void {
    if (!this.canFetch()) return;
    this.hiddenIds.set(new Set());
    this.requestRoomsList(true);
  }

  pinRoom(roomId: string): void {
    this.pinnedIds.update((list) => [roomId, ...list.filter((id) => id !== roomId)]);
  }

  hideRoom(roomId: string): void {
    this.hiddenIds.update((prev) => new Set(prev).add(roomId));
  }

  applyFeedEvent(event: RoomFeedEvent): void {
    this.feedRevision++;
    switch (event.type) {
      case 'SNAPSHOT':
        this.setSnapshot(event.rooms);
        this.error.set(null);
        return;
      case 'ROOM_OPENED':
        this.rawRooms.update((list) => [
          event.room,
          ...(list ?? []).filter((room) => room.id !== event.room.id),
        ]);
        this.resolveRoomPeople([event.room]);
        return;
      case 'ROOM_UPDATED':
        this.rawRooms.update((list) => {
          const current = list ?? [];
          return current.some((room) => room.id === event.room.id)
            ? current.map((room) => (room.id === event.room.id ? event.room : room))
            : [event.room, ...current];
        });
        this.resolveRoomPeople([event.room]);
        return;
      case 'ROOM_CLOSED':
        this.rawRooms.update((list) => (list ?? []).filter((room) => room.id !== event.roomId));
        return;
      case 'ROOM_STATS':
        this.rawRooms.update((list) =>
          (list ?? []).map((room) =>
            room.id === event.roomId
              ? {
                  ...room,
                  speakers: event.live.speakers,
                  participantCount: event.live.participantCount,
                  handRaiseCount: event.live.handRaiseCount,
                }
              : room,
          ),
        );
        void this.identity.resolveUsers(event.live.speakers.slice(0, ROOM_CARD_AVATAR_LIMIT));
    }
  }

  private canFetch(): boolean {
    return isPlatformBrowser(this.platformId) && this.identity.isAuthenticated();
  }

  private handleFeedDisconnect(): void {
    if (!this.feedRequested() || !this.canFetch()) return;

    this.feedRequested.set(false);
    this.reconnectAttempts++;
    this.requestRoomsList(false);

    const polling = this.reconnectAttempts >= ROOMS_POLL_AFTER_ATTEMPTS;
    if (polling) this.startPollingFallback();

    const delayMs = polling
      ? ROOMS_RECONNECT_POLL_DELAY_MS
      : ROOMS_RECONNECT_BASE_DELAY_MS * 2 ** (this.reconnectAttempts - 1);
    if (this.reconnectTimer !== null) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      if (this.feedActive() && this.canFetch()) this.feedRequested.set(true);
    }, delayMs);
  }

  private requestRoomsList(notify: boolean): void {
    if (this.listRequest()) return;
    this.error.set(null);
    this.listRequest.set({ revision: this.feedRevision, notify });
  }

  private finishList(request: ListRequest, rooms?: readonly VoiceRoomDto[], error?: unknown): void {
    if (request !== this.listRequest()) return;
    const current = this.identity.isAuthenticated() && request.revision === this.feedRevision;
    if (current) {
      if (rooms) {
        this.setSnapshot(rooms);
        if (request.notify) {
          this.refreshTickState.update((n) => n + 1);
          this.ensureLoaded();
        }
      } else {
        this.error.set(errorMessage(error, 'Could not load live rooms right now.'));
      }
    }
    this.listRequest.set(null);
  }

  private setSnapshot(rooms: readonly VoiceRoomDto[]): void {
    this.rawRooms.set(rooms);
    this.resolveRoomPeople(rooms);
  }

  private startPollingFallback(): void {
    if (this.pollTimer !== null) return;
    this.pollTimer = setInterval(() => {
      if (this.feedActive() && this.identity.isAuthenticated()) this.requestRoomsList(false);
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
    this.feedRevision++;
    this.reconnectAttempts = 0;
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.stopPollingFallback();
  }

  private resolveRoomPeople(rooms: readonly VoiceRoomDto[]): void {
    void this.identity.resolveUsers(
      rooms.flatMap((room) => room.speakers.slice(0, ROOM_CARD_AVATAR_LIMIT)),
    );
  }
}
