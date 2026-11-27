import type { SocialStatsResponse, UserProfileResponse } from '../../../core/auth/auth.models';
import type { ReactionPresentation } from '../../../shared/models/voice-room.model';

export interface ActionFeedback {
  readonly ok: boolean;
  readonly message?: string;
}

export type RoomConnectionState =
  | { readonly status: 'idle' }
  | { readonly status: 'joining'; readonly roomId: string }
  | { readonly status: 'connected'; readonly roomId: string }
  | { readonly status: 'error'; readonly message: string };

export type ListenerMenuAction = 'stage' | 'approve' | 'profile' | 'remove';

export type SpeakerMenuAction =
  'profile' | 'mute' | 'audience' | 'leave-stage' | 'remove' | 'transfer-host';

export interface ToolbarPendingRequest {
  readonly id: string;
  readonly name: string;
  readonly initial: string;
}

export interface HostProfileDialogData {
  target: ProfilePreviewTarget;
  profile: UserProfileResponse;
  stats: SocialStatsResponse;
  isYou: boolean;
}

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
