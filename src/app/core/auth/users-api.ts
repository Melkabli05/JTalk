import { HttpClient, httpResource } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { lastValueFrom } from 'rxjs';
import { API_BASE_URL } from '../http/api-base-url.token';
import {
  AddLanguageRequest,
  CreateProfileRequest,
  DiscoveredUserResponse,
  FollowListResponse,
  LanguageMatrixResponse,
  SocialStatsResponse,
  UpdateProfileRequest,
  UserPageResponse,
  UserProfileResponse,
  UserSummaryResponse,
} from './auth.models';

@Service()
export class UsersApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_BASE_URL)}/v1/users`;

  meResource(enabled: () => boolean) {
    return httpResource<UserProfileResponse>(() =>
      enabled() ? { url: `${this.base}/me`, transferCache: false } : undefined,
    );
  }

  userResource(userId: () => string | undefined) {
    return httpResource<UserProfileResponse>(() => {
      const id = userId();
      return id
        ? { url: `${this.base}/${encodeURIComponent(id)}`, transferCache: false }
        : undefined;
    });
  }

  createMe(payload: CreateProfileRequest): Promise<UserProfileResponse> {
    return lastValueFrom(this.http.post<UserProfileResponse>(`${this.base}/me`, payload));
  }

  updateMe(payload: UpdateProfileRequest): Promise<UserProfileResponse> {
    return lastValueFrom(this.http.patch<UserProfileResponse>(`${this.base}/me`, payload));
  }

  deleteMe(): Promise<void> {
    return lastValueFrom(this.http.delete<void>(`${this.base}/me`));
  }

  uploadAvatar(imageBlob: Blob): Promise<UserProfileResponse> {
    return lastValueFrom(this.http.put<UserProfileResponse>(`${this.base}/me/avatar`, imageBlob));
  }

  getBatch(ids: readonly string[]): Promise<UserSummaryResponse[]> {
    return lastValueFrom(this.http.post<UserSummaryResponse[]>(`${this.base}/batch`, { ids }));
  }

  searchResource(query: () => string | undefined) {
    return httpResource<DiscoveredUserResponse[]>(() => {
      const q = query();
      return q === undefined
        ? undefined
        : {
            url: `${this.base}/search`,
            params: { q, size: '30' },
            transferCache: false,
          };
    });
  }

  matchmakingResource(params: () => Record<string, string> | undefined) {
    return httpResource<UserPageResponse>(() => {
      const query = params();
      return query && { url: `${this.base}/matchmaking`, params: query, transferCache: false };
    });
  }

  addMyLanguage(req: AddLanguageRequest): Promise<LanguageMatrixResponse> {
    return lastValueFrom(this.http.post<LanguageMatrixResponse>(`${this.base}/me/languages`, req));
  }

  removeMyLanguage(languageCode: string): Promise<LanguageMatrixResponse> {
    return lastValueFrom(
      this.http.delete<LanguageMatrixResponse>(
        `${this.base}/me/languages/${encodeURIComponent(languageCode)}`,
      ),
    );
  }

  follow(userId: string): Promise<void> {
    return lastValueFrom(this.http.post<void>(`${this.base}/${encodeURIComponent(userId)}/follow`, null));
  }

  unfollow(userId: string): Promise<void> {
    return lastValueFrom(this.http.delete<void>(`${this.base}/${encodeURIComponent(userId)}/follow`));
  }

  connectionsResource(
    request: () =>
      | {
          readonly userId: string;
          readonly list: 'followers' | 'following' | 'blocks';
          readonly page: number;
          readonly size: number;
        }
      | undefined,
  ) {
    return httpResource<FollowListResponse | UserSummaryResponse[]>(() => {
      const req = request();
      if (!req) return undefined;
      if (req.list === 'blocks') {
        return {
          url: `${this.base}/me/blocks`,
          transferCache: false,
        };
      }
      return {
        url: `${this.base}/${encodeURIComponent(req.userId)}/${req.list}`,
        params: { page: String(req.page), size: String(req.size) },
        transferCache: false,
      };
    });
  }

  socialStatsResource(userId: () => string | undefined) {
    return httpResource<SocialStatsResponse>(() => {
      const id = userId();
      return id ? { url: `${this.base}/${encodeURIComponent(id)}/social`, transferCache: false } : undefined;
    });
  }

  block(userId: string): Promise<void> {
    return lastValueFrom(this.http.post<void>(`${this.base}/${encodeURIComponent(userId)}/block`, null));
  }

  unblock(userId: string): Promise<void> {
    return lastValueFrom(this.http.delete<void>(`${this.base}/${encodeURIComponent(userId)}/block`));
  }
}
