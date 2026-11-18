import { inject, Service, type Provider } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { msg } from '@shared/utils/i18n/msg';
import { pageVisible } from '@shared/utils/page-visible';
import { saveRequest } from '@shared/utils/save-request';
import {
  concatMap,
  EMPTY,
  map,
  of,
  repeat,
  retry,
  startWith,
  Subject,
  switchMap,
  tap,
  timer,
  type Observable,
} from 'rxjs';
import { RoomsApiService } from '../data-access/rooms-api.service';
import type { RoomListChange } from '../models/room-feed.model';
import type { RoomDraft } from '../models/room.model';
import { RoomListStore } from './room-list.store';

const RECONNECT_FIRST_MS = 1000;
const RECONNECT_LONGEST_MS = 30_000;

@Service()
export class RoomListFacade {
  private readonly api = inject(RoomsApiService);
  readonly state = inject(RoomListStore);
  private readonly again = new Subject<void>();
  readonly opening = saveRequest();

  constructor() {
    // Watched only while the page is on screen: the list is loaded again when it comes back, so a hidden tab costs the server nothing.
    pageVisible()
      .pipe(
        switchMap((visible) =>
          visible
            ? this.again.pipe(
                startWith(undefined),
                switchMap(() => this.watch()),
              )
            : EMPTY,
        ),
        takeUntilDestroyed(),
      )
      .subscribe((change) => this.state.apply(change));
  }

  /** Opens the connection again now, instead of waiting for the next attempt. */
  reconnect(): void {
    this.again.next();
  }

  start(draft: RoomDraft, opened: (roomId: string) => void): void {
    this.opening.run(this.api.create(draft), {
      next: (session) => opened(session.room.id),
      failure: msg('Could not open the room. Please try again.'),
    });
  }

  /**
   * The list once, then what changes. Every connection starts by loading the list (the server says READY when nothing can be missed any
   * more), so the same path serves the first load and a reconnect after the network dropped. Changes that arrive while the list is loading
   * wait their turn. A connection that fails or ends is reopened with a growing pause.
   */
  private watch(): Observable<RoomListChange> {
    return this.api.feed().pipe(
      concatMap((event) =>
        event.type === 'READY'
          ? this.api.rooms().pipe(map((rooms): RoomListChange => ({ type: 'LISTED', rooms })))
          : of(event),
      ),
      tap({ error: () => this.state.failed.set(true) }),
      retry({
        delay: (_error, attempt) =>
          timer(Math.min(RECONNECT_FIRST_MS * 2 ** (attempt - 1), RECONNECT_LONGEST_MS)),
        resetOnSuccess: true,
      }),
      repeat({ delay: RECONNECT_FIRST_MS }),
    );
  }
}

export function provideRoomList(): Provider[] {
  return [RoomListStore, RoomListFacade];
}
