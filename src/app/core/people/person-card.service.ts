import { computed, inject, Service, signal } from '@angular/core';
import type { Observable } from 'rxjs';
import { msg } from '@shared/utils/i18n/msg';
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
  private readonly languagesResource = this.api.languagesResource(this.shown);
  private readonly mineResource = this.api.languagesResource(() =>
    this.shown() === null ? null : this.identity.userId(),
  );

  private readonly details = loadedValue(this.detailsResource);
  private readonly social = loadedValue(this.socialResource);
  private readonly languages = loadedValue(this.languagesResource);
  private readonly mine = loadedValue(this.mineResource);

  readonly userId = this.shown.asReadonly();
  readonly action = saveRequest();

  readonly isMe = computed(() => this.shown() !== null && this.shown() === this.identity.userId());
  readonly loading = computed(() => this.shown() !== null && this.detailsResource.isLoading());
  readonly failed = computed(
    () => this.shown() !== null && this.detailsResource.error() !== undefined,
  );

  readonly card = computed<PersonCard | undefined>(() => {
    const loaded = this.details();
    const languages = this.languages();
    const mine = this.mine();
    const isMe = this.isMe();
    if (loaded?.id !== this.shown()) {
      return undefined;
    }
    const details = loaded;
    return {
      details: { ...details, learning: languages?.learning[0]?.code ?? '' },
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
    this.languagesResource.reload();
  }

  follow(): void {
    this.change((id) => this.api.follow(id), msg('Could not follow them. Please try again.'));
  }

  unfollow(): void {
    this.change((id) => this.api.unfollow(id), msg('Could not unfollow them. Please try again.'));
  }

  block(done: () => void): void {
    this.change((id) => this.api.block(id), msg('Could not block them. Please try again.'), done);
  }

  private change(
    request: (id: string) => Observable<void>,
    failure: string,
    done?: () => void,
  ): void {
    const id = this.shown();
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
