import { Component, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonDirective } from '@openng/optimus-ui/button';
import { Card } from '@openng/optimus-ui/card';
import { Message } from '@openng/optimus-ui/message';
import { Skeleton } from '@openng/optimus-ui/skeleton';
import { ActiveRoomService } from '@core/rooms/active-room.service';
import { RoomStartService } from '@core/rooms/room-start.service';
import { ClockService } from '@core/time/clock.service';
import { I18n } from '@shared/utils/i18n/i18n.service';
import { TranslatePipe } from '@shared/pipes/translate.pipe';
import type { Room, RoomDraft } from '../../models/room.model';
import { provideRoomList, RoomListFacade } from '../../state/room-list.facade';
import { HallwayGreetingComponent } from '../../ui/hallway-greeting/hallway-greeting.component';
import { LanguageFilterComponent } from '../../ui/language-filter/language-filter.component';
import { RoomCardComponent } from '../../ui/room-card/room-card.component';
import { RoomFormDialogComponent } from '../../ui/room-form-dialog/room-form-dialog.component';

@Component({
  selector: 'app-room-list-page',
  imports: [
    ButtonDirective,
    Card,
    HallwayGreetingComponent,
    LanguageFilterComponent,
    Message,
    Skeleton,
    RoomCardComponent,
    RoomFormDialogComponent,
    TranslatePipe,
  ],
  providers: [provideRoomList()],
  templateUrl: './room-list-page.component.html',
  styleUrl: './room-list-page.component.scss',
})
export default class RoomListPageComponent {
  private readonly router = inject(Router);
  private readonly i18n = inject(I18n);
  private readonly roomStart = inject(RoomStartService);
  protected readonly clock = inject(ClockService);
  protected readonly inRoom = inject(ActiveRoomService).room;
  protected readonly facade = inject(RoomListFacade);

  protected readonly state = this.facade.state;
  protected readonly starting = signal(false);

  /** Everyone in the rooms shown. */
  protected readonly people = computed(() =>
    this.state.shown().reduce((sum, room) => sum + room.participantCount, 0),
  );

  protected readonly me = computed(() => this.state.members().get(this.state.meId() ?? '') ?? null);
  protected readonly firstName = computed(() => this.me()?.name.trim().split(/\s+/)[0] ?? '');

  // The sidebar's Go live card asks from any page; the hallway owns the form, so it opens it when it is there.
  private readonly asked = effect(() => {
    if (this.roomStart.requested()) {
      this.roomStart.taken();
      this.starting.set(true);
    }
  });

  protected readonly defaults = computed<RoomDraft>(() => {
    const me = this.me();
    return {
      title: this.i18n.t('Practice room'),
      topic: this.i18n.t('Just chatting'),
      targetLanguage: me?.learning ?? 'es',
      nativeLanguage: me?.nativeLanguage ?? 'en',
      maxStageSeats: 6,
    };
  });

  protected open(room: Room): void {
    void this.router.navigate(['/rooms', room.id]);
  }

  protected start(draft: RoomDraft): void {
    this.facade.start(draft, (id) => {
      this.starting.set(false);
      void this.router.navigate(['/rooms', id]);
    });
  }
}
