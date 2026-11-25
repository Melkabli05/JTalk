import { AvatarSelection } from '../../../core/models/session.model';

export interface ProfileFormSnapshot {
  name: string;
  username: string;
  avatar: AvatarSelection;
  speak: string;
  learn: string;
  location: string;
  about: string;
}

export interface PresetAvatarMeta {
  id: string;
  label: string;
  bg: string;
  extra: boolean;
}
