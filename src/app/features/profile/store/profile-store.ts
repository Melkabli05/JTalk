import { computed, inject, Injectable, linkedSignal, signal } from '@angular/core';
import {
  FollowListResponse,
  LanguageType,
  ProficiencyLevel,
  UserSummaryResponse,
} from '../../../core/auth/auth.models';
import { IdentityStore } from '../../../core/auth/identity';
import { UsersApi } from '../../../core/auth/users-api';
import { errorMessage } from '../../../core/http/http-error.interceptor';
import { PROFILE_CONNECTIONS_PAGE_SIZE } from '../constants/profile.constants';

export type ProfileConnectionList = 'followers' | 'following' | 'blocks';

interface ConnectionsRequest {
  readonly userId: string;
  readonly list: ProfileConnectionList;
  readonly page: number;
}

@Injectable()
export class ProfileStore {
  private readonly identity = inject(IdentityStore);
  private readonly usersApi = inject(UsersApi);

  readonly editingLanguages = signal(false);
  readonly languageBusy = signal(false);

  private readonly connectionsRequest = signal<ConnectionsRequest | null>(null);
  private readonly connectionsRes = this.usersApi.connectionsResource(() => {
    const req = this.connectionsRequest();
    return req
      ? { userId: req.userId, list: req.list, page: req.page, size: PROFILE_CONNECTIONS_PAGE_SIZE }
      : undefined;
  });

  readonly connectionList = computed(() => this.connectionsRequest()?.list ?? null);
  readonly connectionsBusy = this.connectionsRes.isLoading;
  readonly connectionsError = computed(() => {
    const err = this.connectionsRes.error();
    return err ? errorMessage(err, 'Could not load accounts.') : null;
  });

  readonly connections = linkedSignal<
    {
      request: ConnectionsRequest | null;
      page: FollowListResponse | UserSummaryResponse[] | undefined;
    },
    readonly UserSummaryResponse[]
  >({
    source: () => ({
      request: this.connectionsRequest(),
      page: this.connectionsRes.hasValue() ? this.connectionsRes.value() : undefined,
    }),
    computation: ({ request, page }, previous) => {
      if (!request) return [];
      if (!page) return request.page > 0 ? (previous?.value ?? []) : [];
      if (previous && page === previous.source.page) return previous.value;
      if (Array.isArray(page)) return page;
      return request.page > 0 ? [...(previous?.value ?? []), ...page.content] : page.content;
    },
  });

  readonly moreConnections = computed(() => {
    if (!this.connectionsRes.hasValue()) return false;
    const page = this.connectionsRes.value();
    return !Array.isArray(page) && (page.page + 1) * page.size < page.total;
  });

  loadConnections(list: ProfileConnectionList, append = false): void {
    const userId = this.identity.me()?.id;
    if (!userId) return;

    const current = this.connectionsRequest();
    if (append && (!this.moreConnections() || this.connectionsBusy() || current?.list !== list)) return;
    const previousPage = this.connectionsRes.hasValue() ? this.connectionsRes.value() : undefined;
    const page = append && previousPage && !Array.isArray(previousPage) ? previousPage.page + 1 : 0;
    if (current?.userId === userId && current.list === list && current.page === page) {
      this.connectionsRes.reload();
    } else {
      this.connectionsRequest.set({ userId, list, page });
    }
  }

  async unblock(id: string): Promise<string | null> {
    try {
      await this.usersApi.unblock(id);
      if (this.connectionList() === 'blocks') {
        this.loadConnections('blocks');
      }
      return null;
    } catch (err) {
      return errorMessage(err, 'Could not unblock account.');
    }
  }

  async changeLanguage(
    code: string,
    type?: LanguageType,
    proficiencyLevel?: ProficiencyLevel,
  ): Promise<string | null> {
    if (this.languageBusy()) return null;
    this.languageBusy.set(true);
    try {
      const matrix = type
        ? await this.usersApi.addMyLanguage({
            languageCode: code,
            languageType: type,
            ...(type === 'LEARNING' && proficiencyLevel ? { proficiencyLevel } : {}),
          })
        : await this.usersApi.removeMyLanguage(code);

      this.identity.me.update((profile) =>
        profile?.id === matrix.userId
          ? {
              ...profile,
              nativeLanguages: matrix.nativeLanguages,
              learningLanguages: matrix.learningLanguages,
            }
          : profile,
      );
      return null;
    } catch (err) {
      return errorMessage(err, 'Could not update languages.');
    } finally {
      this.languageBusy.set(false);
    }
  }
}
