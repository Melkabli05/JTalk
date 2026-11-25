import type { ReactionPresentation } from '../../../shared/models/voice-room.model';

export type RoomSpeakerRole = 'host' | 'speaker';

export interface RoomSpeaker {
  avatarUrl?: string | null;
  id: string;
  name: string;
  initial: string;
  chipClass: string;
  role: RoomSpeakerRole;
  isYou?: boolean;
  muted: boolean;
  speaking: boolean;
}

export interface RoomListener {
  avatarUrl?: string | null;
  id: string;
  name: string;
  initial: string;
  chipClass: string;
  handRaised: boolean;
}

export interface MessageReaction extends ReactionPresentation {
  count: number;
  active: boolean;
}

export interface DiscussionMessage {
  id: string;
  authorId?: string;
  author: string;
  avatarText: string;
  avatarClass: string;
  isHost?: boolean;
  isYou?: boolean;
  isThreadReply?: boolean;
  timeLabel: string;
  text: string;
  reactions: readonly MessageReaction[];
}

export interface ProfilePreviewTarget {
  kind: 'host' | 'speaker' | 'listener';
  muted?: boolean;
}
