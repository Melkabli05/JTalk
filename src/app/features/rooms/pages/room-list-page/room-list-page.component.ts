import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { ButtonDirective } from '@openng/optimus-ui/button';
import { Message } from '@openng/optimus-ui/message';
import { Skeleton } from '@openng/optimus-ui/skeleton';
import { interval } from 'rxjs';
import { IdentityService } from '@core/auth/identity.service';
import { I18n } from '@shared/utils/i18n/i18n.service';
import { TranslatePipe } from '@shared/pipes/translate.pipe';
import { BrandMarkComponent } from '@shared/ui/brand-mark/brand-mark.component';
import { msg } from '@shared/utils/i18n/msg';
import { saveRequest } from '@shared/utils/save-request';
import { RoomsApiService } from '../../data-access/rooms-api.service';
import type { Room, RoomDraft } from '../../models/room.model';
import { LanguageFilterComponent } from '../../ui/language-filter/language-filter.component';
import { RoomCardComponent } from '../../ui/room-card/room-card.component';
import { RoomFormDialogComponent } from '../../ui/room-form-dialog/room-form-dialog.component';

const REFRESH_MS = 5000;

/** Container: the hallway. Lists the open rooms (kept fresh), filters them by language, and opens or starts one. */
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
  templateUrl: './room-list-page.component.html',
  styleUrl: './room-list-page.component.scss',
})
export default class RoomListPageComponent {
  private readonly router = inject(Router);
  private readonly api = inject(RoomsApiService);
  private readonly identity = inject(IdentityService);
  private readonly i18n = inject(I18n);

  protected readonly rooms = this.api.roomsResource();
  protected readonly members = this.identity.directory;
  protected readonly filter = signal('');
  protected readonly starting = signal(false);
  protected readonly saving = saveRequest();

  /** What a new room starts as: a title and topic in the current language, and the languages of the person opening it, when known. */
  protected readonly defaults = computed<RoomDraft>(() => {
    const me = this.members().get(this.identity.userId() ?? '');
    return {
      title: this.i18n.t('Practice room'),
      topic: this.i18n.t('Just chatting'),
      targetLanguage: me?.learning ?? 'es',
      nativeLanguage: me?.nativeLanguage ?? 'en',
      maxStageSeats: 6,
    };
  });

  private readonly all = computed(() => (this.rooms.hasValue() ? this.rooms.value() : []));
  protected readonly languages = computed(() => [
    ...new Set(this.all().map((room) => room.targetLanguage)),
  ]);
  protected readonly shown = computed(() =>
    this.all().filter((room) => !this.filter() || room.targetLanguage === this.filter()),
  );

  constructor() {
    interval(REFRESH_MS)
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.rooms.reload());
  }

  protected open(room: Room): void {
    void this.router.navigate(['/rooms', room.id]);
  }

  protected start(draft: RoomDraft): void {
    this.saving.run(this.api.create(draft), {
      next: (session) => {
        this.starting.set(false);
        void this.router.navigate(['/rooms', session.room.id]);
      },
      failure: msg('Could not open the room. Please try again.'),
    });
  }
}
