export type ProficiencyLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'FLUENT';
export type LanguageType = 'NATIVE' | 'LEARNING';

export interface LearningLanguageEntry {
  readonly languageCode: string;
  readonly proficiencyLevel?: ProficiencyLevel | null;
}

export interface LanguageMatrixResponse {
  readonly userId: string;
  readonly nativeLanguages: readonly string[];
  readonly learningLanguages: readonly LearningLanguageEntry[];
}

export interface UserProfileResponse {
  readonly id: string;
  readonly username: string;
  readonly displayName: string;
  readonly bio?: string | null;
  readonly avatarUrl?: string | null;
  readonly countryCode?: string | null;
  readonly nativeLanguage: string;
  readonly learningLanguages: readonly LearningLanguageEntry[];
  readonly nativeLanguages: readonly string[];
  readonly createdAt: string;
  readonly socialStats?: SocialStatsResponse | null;
}

export interface UserSummaryResponse {
  readonly id: string;
  readonly username: string;
  readonly displayName: string;
  readonly avatarUrl?: string | null;
  readonly countryCode?: string | null;
  readonly nativeLanguage: string;
}

export interface DiscoveredUserResponse extends UserSummaryResponse {
  readonly followedByMe: boolean;
}

export interface UserPageResponse {
  readonly content: readonly DiscoveredUserResponse[];
  readonly hasNext: boolean;
  readonly nextAfterCreatedAt: string | null;
  readonly nextAfterId: string | null;
}

export interface FollowListResponse {
  readonly content: readonly UserSummaryResponse[];
  readonly page: number;
  readonly size: number;
  readonly total: number;
}

export interface SocialStatsResponse {
  readonly followerCount: number;
  readonly followingCount: number;
  readonly followedByMe: boolean;
  readonly followsMe: boolean;
}

export interface CreateProfileRequest {
  readonly username?: string;
  readonly displayName: string;
  readonly bio?: string | null;
  readonly avatarUrl?: string | null;
  readonly countryCode?: string | null;
  readonly nativeLanguage: string;
  readonly learningLanguages?: readonly LearningLanguageEntry[];
}

export interface UpdateProfileRequest {
  readonly username?: string;
  readonly displayName?: string;
  readonly bio?: string;
  readonly avatarUrl?: string;
  readonly countryCode?: string;
  readonly nativeLanguage?: string;
  readonly learningLanguages?: readonly LearningLanguageEntry[];
}

export interface AddLanguageRequest {
  readonly languageCode: string;
  readonly languageType: LanguageType;
  readonly proficiencyLevel?: ProficiencyLevel;
}

export type ProfileLoadStatus = 'unauthenticated' | 'loading' | 'ready' | 'missing' | 'error';

export interface ProfileSaveInput {
  readonly displayName: string;
  readonly username: string;
  readonly nativeLanguage: string;
  readonly learningLanguage: string | null;
  readonly learningLanguages?: readonly LearningLanguageEntry[];
  readonly countryCode: string | null;
  readonly bio: string;
  readonly avatarUrl?: string | null;
}

export interface ProfileSaveResult {
  readonly ok: boolean;
  readonly profile?: UserProfileResponse;
  readonly error?: string;
  readonly errorType?: string;
}

export interface AccountActionResult {
  readonly ok: boolean;
  readonly error?: string;
}
