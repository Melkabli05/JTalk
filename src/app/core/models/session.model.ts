export type AppView = 'rooms' | 'room' | 'people' | 'profile';

export type ProfileTab = 'overview' | 'edit' | 'account';

export type AvatarChoiceKind = 'own' | 'preset';

export interface AvatarSelection {
  kind: AvatarChoiceKind;
  id: string;
  bg: string;
  label: string;
  imageUrl?: string | null;
}

export interface UserProfile {
  id?: string;
  name: string;
  username: string;
  avatar: AvatarSelection;
  speak: string;
  learn: string;
  location: string;
  about: string;
  joined: string;
  followers: number;
  following: number;
}
