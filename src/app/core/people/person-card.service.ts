import { computed, inject, Service, signal } from '@angular/core';
import type { Observable } from 'rxjs';
import { partnerMatch } from '@shared/utils/people';
import { loadedValue } from '@shared/utils/resource-value';
import { saveRequest } from '@shared/utils/save-request';
import { IdentityService } from '../auth/identity.service';
import { PeopleApiService } from './people-api.service';
import type { PersonCard } from './person-card.model';

@Service()
export class PersonCardService {
  private readonly api = inject(PeopleApiService);
  private readonly identity = inject(IdentityService);

  private readonly shown = signal<string | null>(null);
  private readonly detailsResource = this.api.detailsResource(this.shown);
  private readonly socialResource = this.api.socialResource(this.shown);

  private readonly details = loadedValue(this.detailsResource);
  private readonly social = loadedValue(this.socialResource);

  readonly userId = this.shown.asReadonly();
  readonly action = saveRequest();

  readonly isMe = computed(() => this.shown() !== null && this.shown() === this.identity.userId());
  readonly loading = computed(() => this.shown() !== null && this.detailsResource.isLoading());
  readonly failed = computed(
    () => this.shown() !== null && this.detailsResource.error() !== undefined,
  );

  readonly card = computed<PersonCard | undefined>(() => {
    const details = this.details();
    const mine = this.identity.profile()?.languages;
    const isMe = this.isMe();
    if (details?.id !== this.shown()) {
      return undefined;
    }
    const languages = details.languages;
    return {
      details,
      social: this.social(),
      languages,
      match:
        !isMe && languages !== undefined && mine !== undefined
          ? partnerMatch(mine, languages)
          : undefined,
      isMe,
    };
  });

  show(id: string | null): void {
    this.shown.set(id);
  }

  reload(): void {
    this.detailsResource.reload();
    this.socialResource.reload();
  }

  follow(): void {
    this.change((id) => this.api.follow(id), 'Could not follow them. Please try again.');
  }

  unfollow(): void {
    this.change((id) => this.api.unfollow(id), 'Could not unfollow them. Please try again.');
  }

  /** Blocks the person whose card is open, or anyone else by id (the host's menu on a seat). */
  block(done: () => void, id: string | null = this.shown()): void {
    this.change(
      (target) => this.api.block(target),
      'Could not block them. Please try again.',
      done,
      id,
    );
  }

  private change(
    request: (id: string) => Observable<void>,
    failure: string,
    done?: () => void,
    id: string | null = this.shown(),
  ): void {
    if (id === null) {
      return;
    }
    this.action.run(request(id), {
      next: () => {
        this.socialResource.reload();
        done?.();
      },
      failure,
    });
  }
}
