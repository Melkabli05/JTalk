import type { SocialStatsResponse, UserProfileResponse } from '../../../core/auth/auth.models';
import type { ReactionPresentation } from '../../../shared/models/voice-room.model';

export interface ActionFeedback {
  readonly ok: boolean;
  readonly message?: string;
  readonly code?: string;
}

export interface StageReaction {
  readonly id: number;
  readonly userId: string;
  readonly emoji: string;
  readonly reactorName: string;
  readonly count: number;
  readonly lane: number;
}

export type RoomConnectionState =
  | { readonly status: 'idle' }
  | { readonly status: 'joining'; readonly roomId: string }
  | { readonly status: 'connected'; readonly roomId: string }
  | { readonly status: 'ended'; readonly message: string }
  | { readonly status: 'kicked'; readonly message: string }
  | { readonly status: 'error'; readonly message: string };

export type ListenerMenuAction = 'stage' | 'approve' | 'profile' | 'transfer-host' | 'remove';

export type SpeakerMenuAction =
  'profile' | 'mute' | 'audience' | 'leave-stage' | 'remove' | 'transfer-host';

export interface ConfirmActionDialogData {
  readonly title: string;
  readonly message: string;
  readonly confirmLabel: string;
  readonly danger?: boolean;
}

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
  onToggleFollow?: (follow: boolean) => Promise<boolean>;
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
  reconnecting?: boolean;
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

export interface CorrectionDiffPart {
  readonly text: string;
  readonly changed: boolean;
}

export interface MessageCorrection {
  readonly originalParts: readonly CorrectionDiffPart[];
  readonly correctedParts: readonly CorrectionDiffPart[];
  readonly tip?: string;
}

export interface DiscussionMessage {
  id: string;
  authorId?: string;
  author: string;
  avatarUrl?: string | null;
  avatarText: string;
  avatarClass: string;
  isHost?: boolean;
  isYou?: boolean;
  isThreadReply?: boolean;
  timeLabel: string;
  text: string;
  correction?: MessageCorrection;
  reactions: readonly MessageReaction[];
}

export interface ProfilePreviewTarget {
  kind: 'host' | 'speaker' | 'listener' | 'member';
  muted?: boolean;
}
