import type { ProfileSaveInput } from '../../../core/auth/auth.models';

export type ProfileConnectionList = 'followers' | 'following' | 'blocks';

export interface ProfileEditSaveEvent {
  readonly input: ProfileSaveInput;
  readonly avatarBlob: Blob | null;
}
