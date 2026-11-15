import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonDirective } from '@openng/optimus-ui/button';
import { Message } from '@openng/optimus-ui/message';
import { Skeleton } from '@openng/optimus-ui/skeleton';
import { I18n } from '@shared/utils/i18n/i18n.service';
import { TranslatePipe } from '@shared/pipes/translate.pipe';
import { BrandMarkComponent } from '@shared/ui/brand-mark/brand-mark.component';
import type { Room, RoomDraft } from '../../models/room.model';
import { provideRooms, RoomsFacade } from '../../state/rooms.facade';
import { LanguageFilterComponent } from '../../ui/language-filter/language-filter.component';
import { RoomCardComponent } from '../../ui/room-card/room-card.component';
import { RoomFormDialogComponent } from '../../ui/room-form-dialog/room-form-dialog.component';

/**
 * Container: the hallway. Shows the open rooms the facade keeps fresh, and turns what the person does (narrow by language,
 * open a room, start one) into calls on it. Opening a room is the one thing it does itself: it moves to the room's route.
 */
@Component({
  selector: 'app-room-list-page',
  imports: [
    BrandMarkComponent,
    ButtonDirective,
    LanguageFilterComponent,
    Message,
    Skeleton,
    RoomCardComponent,
    RoomFormDialogComponent,
    TranslatePipe,
  ],
  providers: [provideRooms()],
  templateUrl: './room-list-page.component.html',
  styleUrl: './room-list-page.component.scss',
})
export default class RoomListPageComponent {
  private readonly router = inject(Router);
  private readonly i18n = inject(I18n);
  protected readonly facade = inject(RoomsFacade);

  protected readonly state = this.facade.state;
  protected readonly starting = signal(false);

  /** What a new room starts as: a title and topic in the current language, and the languages of the person opening it, when known. */
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
