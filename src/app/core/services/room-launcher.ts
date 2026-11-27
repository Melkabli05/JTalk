import { DestroyRef, inject, Service } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { IdentityStore } from '../auth/identity';
import { errorMessage } from '../http/http-error.interceptor';
import { LANGUAGE_CATALOG } from '../utils/language-codes';
import { LAST_ROOM_PREFS_STORAGE_KEY } from '../../shared/constants/storage-keys.constants';
import { CreateVoiceRoomPayload } from '../../shared/models/voice-room.model';
import { BrowserStorage } from './browser-storage';
import { ToastNotifier } from './toast-notifier';
import { RoomsApi } from '../../features/rooms/data-access/rooms-api';
import type { StartRoomDialogData } from '../../layout/ui/start-room-dialog/start-room-dialog';

interface SavedRoomPrefs {
  readonly targetLanguage: string;
  readonly nativeLanguage: string;
  readonly maxStageSeats: number;
}

const VALID_LANG_CODES = new Set(LANGUAGE_CATALOG.map((lang) => lang.code));

function isSavedRoomPrefs(value: unknown): value is SavedRoomPrefs {
  if (typeof value !== 'object' || value === null) return false;
  const target: unknown = Reflect.get(value, 'targetLanguage');
  const native: unknown = Reflect.get(value, 'nativeLanguage');
  const seats: unknown = Reflect.get(value, 'maxStageSeats');
  return (
    typeof target === 'string' &&
    VALID_LANG_CODES.has(target) &&
    typeof native === 'string' &&
    VALID_LANG_CODES.has(native) &&
    typeof seats === 'number' &&
    Number.isInteger(seats) &&
    seats >= 2 &&
    seats <= 12
  );
}

function normalizeCatalogCode(code: string | null | undefined): string | null {
  if (!code) return null;
  const base = code.split('-')[0]?.toLowerCase() ?? '';
  return VALID_LANG_CODES.has(base) ? base : null;
}

@Service()
export class RoomLauncher {
  private readonly dialog = inject(MatDialog);
  private readonly identity = inject(IdentityStore);
  private readonly roomsApi = inject(RoomsApi);
  private readonly router = inject(Router);
  private readonly storage = inject(BrowserStorage);
  private readonly toast = inject(ToastNotifier);
  private creatingRoom = false;

  openStartRoom(destroyRef?: DestroyRef): void {
    if (this.creatingRoom) return;

    if (!this.identity.isAuthenticated()) {
      this.identity.signIn('login', '/rooms');
      return;
    }

    if (this.identity.needsOnboarding()) {
      this.toast.show('Create your profile first to start a room.');
      void this.router.navigate(['/profile']);
      return;
    }

    const dialogId = 'start-room';
    const defaults = this.resolveDefaults();
    void import('../../layout/ui/start-room-dialog/start-room-dialog').then(
      (dialogModule) => {
        if (destroyRef?.destroyed || this.creatingRoom || this.dialog.getDialogById(dialogId)) {
          return;
        }
        let handledInDialog = false;
        const ref = this.dialog.open<
          InstanceType<typeof dialogModule.StartRoomDialog>,
          StartRoomDialogData,
          CreateVoiceRoomPayload
        >(dialogModule.StartRoomDialog, {
          id: dialogId,
          width: '560px',
          maxWidth: 'calc(100vw - 24px)',
          autoFocus: 'first-tabbable',
          data: {
            defaults,
            submit: async (config) => {
              handledInDialog = true;
              return this.submitRoom(config, destroyRef);
            },
          },
        });

        ref.afterClosed().subscribe((config) => {
          if (handledInDialog || !config || destroyRef?.destroyed || this.creatingRoom) return;
          void this.submitRoom(config, destroyRef).then((err) => {
            if (err && !destroyRef?.destroyed) {
              this.toast.show(err);
            }
          });
        });
      },
      () => {
        if (!destroyRef?.destroyed) {
          this.toast.show('Could not load the room form. Please try again.');
        }
      },
    );
  }

  private resolveDefaults(): StartRoomDialogData['defaults'] {
    const saved = this.storage.getJson<SavedRoomPrefs | null>(
      'local',
      LAST_ROOM_PREFS_STORAGE_KEY,
      (v): v is SavedRoomPrefs | null => v === null || isSavedRoomPrefs(v),
      null,
    );
    const me = this.identity.me();
    const profileLearn = normalizeCatalogCode(me?.learningLanguages[0]?.languageCode);
    const profileNative = normalizeCatalogCode(me?.nativeLanguage);
    const nativeLanguage = saved?.nativeLanguage ?? profileNative ?? 'en';
    const targetLanguage =
      saved?.targetLanguage ?? profileLearn ?? (nativeLanguage === 'es' ? 'en' : 'es');
    return {
      targetLanguage,
      nativeLanguage,
      maxStageSeats: saved?.maxStageSeats ?? 8,
    };
  }

  private async submitRoom(
    config: CreateVoiceRoomPayload,
    destroyRef?: DestroyRef,
  ): Promise<string | null> {
    if (this.creatingRoom || destroyRef?.destroyed) return null;
    this.creatingRoom = true;
    try {
      const session = await firstValueFrom(this.roomsApi.createRoom(config));
      this.creatingRoom = false;
      this.storage.setJson('local', LAST_ROOM_PREFS_STORAGE_KEY, {
        targetLanguage: config.targetLanguage,
        nativeLanguage: config.nativeLanguage,
        maxStageSeats: config.maxStageSeats ?? 8,
      } satisfies SavedRoomPrefs);
      const reusedExisting = session.room.title !== config.title;
      const navigated = await this.router.navigate(['/room', session.room.id]);
      if (navigated && !destroyRef?.destroyed) {
        this.toast.show(
          reusedExisting
            ? 'You already have a live room open — taking you back to it.'
            : 'Room open.',
        );
      }
      return null;
    } catch (err: unknown) {
      this.creatingRoom = false;
      return errorMessage(err, 'Could not start the room.');
    }
  }
}
