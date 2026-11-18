import { ActiveRoomService } from '../rooms/active-room.service';
import { HttpErrorResponse } from '@angular/common/http';
import { computed, inject, Service, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from '@auth0/auth0-angular';
import { firstValueFrom } from 'rxjs';
import { avatarPath } from '@shared/utils/avatars';
import { httpStatus } from '@shared/utils/http-status';
import { loadedValue } from '@shared/utils/resource-value';
import type { Person, ProfileDraft } from './identity.models';
import { UsersApiService } from './users-api.service';

/** The user service takes at most this many ids in one lookup. */
const MAX_LOOKUP = 500;

function extras(draft: ProfileDraft, clearable: boolean): { bio?: string; countryCode?: string } {
  const bio = draft.bio?.trim();
  return {
    ...(bio === undefined || (bio === '' && !clearable) ? {} : { bio }),
    ...(draft.countryCode ? { countryCode: draft.countryCode } : {}),
  };
}

/** A handle people never see, made from the name and a random tail so two people called Mona do not collide. */
function usernameFor(name: string): string {
  const base = name
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 20);
  return `${base || 'user'}_${crypto.randomUUID().replaceAll('-', '').slice(0, 6)}`;
}

/**
 * Who is signed in and who everyone else is. Signing in is Auth0's (the SDK holds the session and the interceptor adds the access token);
 * the profile lives in the user service. A person who has signed in but has no profile yet gets {@link needsProfile}, which asks for one.
 */
@Service()
export class IdentityService {
  private readonly auth = inject(AuthService);
  private readonly activeRoom = inject(ActiveRoomService);
  private readonly api = inject(UsersApiService);

  readonly signedIn = toSignal(this.auth.isAuthenticated$, { initialValue: false });

  private readonly meResource = this.api.meResource(this.signedIn);
  private readonly mine = loadedValue(this.meResource);
  private readonly learningResource = this.api.learningResource(() => this.meResource.hasValue());
  private readonly learning = loadedValue(this.learningResource);

  private readonly others = signal<ReadonlyMap<string, Person>>(new Map());
  private readonly asked = new Set<string>();

  readonly profile = computed<Person | null>(() => {
    const me = this.mine();
    return me === undefined ? null : { ...me, learning: this.learning()?.[0] ?? '' };
  });
  readonly userId = computed(() => this.mine()?.id ?? null);
  readonly needsProfile = computed(
    () => this.signedIn() && httpStatus(this.meResource.error()) === 404,
  );
  /** Everyone whose name and picture are known: the person signed in, and whoever {@link resolve} has looked up. */
  readonly directory = computed<ReadonlyMap<string, Person>>(() => {
    const known = new Map(this.others());
    const me = this.profile();
    if (me) {
      known.set(me.id, me);
    }
    return known;
  });

  /** Looks up people not seen yet, in one call, so the rooms can show names and pictures instead of ids. */
  resolve(ids: Iterable<string>): void {
    const me = this.userId();
    const missing = [...new Set(ids)].filter((id) => id !== '' && id !== me && !this.asked.has(id));
    for (let start = 0; start < missing.length; start += MAX_LOOKUP) {
      const batch = missing.slice(start, start + MAX_LOOKUP);
      batch.forEach((id) => this.asked.add(id));
      this.api.people(batch).subscribe({
        next: (people) => {
          this.others.update(
            (known) => new Map([...known, ...people.map((p) => [p.id, p] as const)]),
          );
        },
        error: () => {
          batch.forEach((id) => this.asked.delete(id)); // a failed lookup is tried again the next time they are on screen
        },
      });
    }
  }

  /** Creates the profile on the first save, and changes it after that. */
  async saveProfile(draft: ProfileDraft): Promise<void> {
    const current = this.mine();
    if (current === undefined) {
      await this.createProfile(draft);
    } else {
      await this.changeProfile(draft);
    }
    this.meResource.reload();
    this.learningResource.reload();
  }

  async signOut(): Promise<void> {
    this.activeRoom.leave();
    await firstValueFrom(this.auth.logout({ logoutParams: { returnTo: window.location.origin } }));
  }

  private async createProfile(draft: ProfileDraft): Promise<void> {
    const profile = (username: string) => ({
      username,
      displayName: draft.name.trim(),
      avatarUrl: avatarPath(draft.avatar),
      nativeLanguage: draft.nativeLanguage,
      ...extras(draft, false),
    });
    try {
      await firstValueFrom(this.api.create(profile(usernameFor(draft.name))));
    } catch (error) {
      if (!(error instanceof HttpErrorResponse) || error.status !== 409) {
        throw error;
      }
      // The random tail collided with someone else's handle (or the first request already went through): try once with another.
      await firstValueFrom(this.api.create(profile(usernameFor(draft.name))));
    }
    await firstValueFrom(this.api.addLearning(draft.learning));
  }

  private async changeProfile(draft: ProfileDraft): Promise<void> {
    // The language being learned first: a new native language may be one that is being dropped here, and the service keeps a language
    // either native or learned, never both.
    const learned = this.learning() ?? [];
    for (const code of learned.filter((language) => language !== draft.learning)) {
      await firstValueFrom(this.api.removeLanguage(code));
    }
    if (!learned.includes(draft.learning)) {
      await firstValueFrom(this.api.addLearning(draft.learning));
    }
    await firstValueFrom(
      this.api.update({
        displayName: draft.name.trim(),
        avatarUrl: avatarPath(draft.avatar),
        nativeLanguage: draft.nativeLanguage,
        ...extras(draft, true),
      }),
    );
  }
}
