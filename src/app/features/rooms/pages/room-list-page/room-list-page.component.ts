import { Component, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonDirective } from '@openng/optimus-ui/button';
import { Card } from '@openng/optimus-ui/card';
import { Message } from '@openng/optimus-ui/message';
import { Skeleton } from '@openng/optimus-ui/skeleton';
import { RoomStartService } from '@core/rooms/room-start.service';
import { msg } from '@shared/utils/i18n/msg';
import { I18n } from '@shared/utils/i18n/i18n.service';
import { TranslatePipe } from '@shared/pipes/translate.pipe';
import type { Room, RoomDraft } from '../../models/room.model';
import { provideRoomList, RoomListFacade } from '../../state/room-list.facade';
import { LanguageFilterComponent } from '../../ui/language-filter/language-filter.component';
import { RoomCardComponent } from '../../ui/room-card/room-card.component';
import { RoomFormDialogComponent } from '../../ui/room-form-dialog/room-form-dialog.component';

const GREETINGS = {
  morning: [msg('Good morning'), msg('Good morning, {name}')],
  afternoon: [msg('Good afternoon'), msg('Good afternoon, {name}')],
  evening: [msg('Good evening'), msg('Good evening, {name}')],
} as const;

/** The part of the day an hour belongs to. */
export function partOfDay(hour: number): keyof typeof GREETINGS {
  return hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
}

@Component({
  selector: 'app-room-list-page',
  imports: [
    ButtonDirective,
    Card,
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
  protected readonly facade = inject(RoomListFacade);

  protected readonly state = this.facade.state;
  protected readonly starting = signal(false);

  protected readonly firstName = computed(
    () =>
      this.state
        .members()
        .get(this.state.meId() ?? '')
        ?.name.trim()
        .split(/\s+/)[0] ?? '',
  );
  protected readonly greeting = computed(
    () => GREETINGS[partOfDay(new Date().getHours())][this.firstName() === '' ? 0 : 1],
  );

  // The sidebar's Go live card asks from any page; the hallway owns the form, so it opens it when it is there.
  private readonly asked = effect(() => {
    if (this.roomStart.requested()) {
      this.roomStart.taken();
      this.starting.set(true);
    }
  });

  protected readonly defaults = computed<RoomDraft>(() => {
    const me = this.state.members().get(this.state.meId() ?? '');
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
