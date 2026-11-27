import type {
  LanguageType,
  ProficiencyLevel,
  ProfileSaveInput,
} from '../../../core/auth/auth.models';

export type ProfileConnectionList = 'followers' | 'following' | 'blocks';

export interface ProfileEditSaveEvent {
  readonly input: ProfileSaveInput;
  readonly avatarBlob: Blob | null;
}

export interface ProfileLanguageEditorData {
  readonly mode: 'add' | 'edit';
  readonly existingCodes: readonly string[];
  readonly primaryNativeCode: string;
  readonly initialCode?: string;
  readonly initialRole?: LanguageType;
  readonly initialLevel?: ProficiencyLevel;
  readonly allowNativeRole?: boolean;
}

export interface ProfileLanguageEditorResult {
  readonly code: string;
  readonly role: LanguageType;
  readonly level: ProficiencyLevel | null;
}

export interface ProfileServerFieldErrors {
  readonly username?: string | null;
  readonly avatar?: string | null;
  readonly languages?: string | null;
}
