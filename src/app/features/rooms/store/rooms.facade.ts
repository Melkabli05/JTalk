import { DestroyRef, inject, Service, type Signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { RoomLauncher } from '../../../core/services/room-launcher';
import { ToastNotifier } from '../../../core/services/toast-notifier';
import type { VoiceRoomDto } from '../../../shared/models/voice-room.model';
import type { RoomLangFilter } from '../constants/rooms.constants';
import type { RoomFeedEvent } from '../models/room-feed.model';
import { RoomsStore } from './rooms.store';

/**
 * Rooms feature facade: coordinates view-level navigation, toasts, and room launching
 * on top of {@link RoomsStore}.
 */
@Service()
export class RoomsFacade {
  private readonly store = inject(RoomsStore);
  private readonly destroyRef = inject(DestroyRef);
  private readonly toast = inject(ToastNotifier, { optional: true });
  private readonly router = inject(Router, { optional: true });
  private readonly roomLauncher = inject(RoomLauncher, { optional: true });

  readonly targetLanguage: Signal<RoomLangFilter> = this.store.targetLanguage;
  readonly hasLoaded: Signal<boolean> = this.store.hasLoaded;
  readonly error: Signal<string | null> = this.store.error;
  readonly pinnedIdsSet: Signal<ReadonlySet<string>> = this.store.pinnedIdsSet;
  readonly loading: Signal<boolean> = this.store.loading;
  readonly rooms: Signal<readonly VoiceRoomDto[]> = this.store.rooms;
  readonly liveCount: Signal<number> = this.store.liveCount;

  ensureLoaded(): void {
    this.store.ensureLoaded();
  }

  setTargetLanguage(filter: RoomLangFilter, route?: ActivatedRoute): void {
    this.store.setTargetLanguage(filter);
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
    this.store.refresh((ok) => {
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
    const pinned = this.store.togglePin(roomId);
    this.toast?.show(pinned ? 'Pinned to top.' : 'Unpinned.');
  }

  hideRoom(roomId: string): void {
    this.store.hideRoom(roomId);
    if (typeof this.toast?.showAction === 'function') {
      this.toast.showAction('Hidden from list.', 'Undo', () => this.unhideRoom(roomId));
    } else {
      this.toast?.show('Hidden from list.');
    }
  }

  unhideRoom(roomId: string): void {
    this.store.unhideRoom(roomId);
  }

  applyFeedEvent(event: RoomFeedEvent): void {
    this.store.applyFeedEvent(event);
  }
}
