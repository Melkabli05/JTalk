export type BackendRoomRole = 'HOST' | 'SPEAKER' | 'LISTENER';

export type NetworkMode = 'OPTIMAL' | 'LOW_BANDWIDTH';

export type CommentType = 'TEXT' | 'CORRECTION';

export const BACKEND_REACTIONS = [
  'HEART',
  'CLAP',
  'THUMBS_UP',
  'SMILE',
  'SPARKLES',
  'FIRE',
  'PARTY',
  'LAUGH',
  'WOW',
  'THANKS',
] as const;

export type BackendReaction = (typeof BACKEND_REACTIONS)[number];

export interface ReactionPresentation {
  readonly code: BackendReaction;
  readonly emoji: string;
  readonly label: string;
}

export const REACTION_CATALOG: readonly ReactionPresentation[] = [
  { code: 'THUMBS_UP', emoji: '👍', label: 'Thumbs up' },
  { code: 'HEART', emoji: '❤️', label: 'Heart' },
  { code: 'LAUGH', emoji: '😂', label: 'Laughter' },
  { code: 'CLAP', emoji: '👏', label: 'Applause' },
  { code: 'FIRE', emoji: '🔥', label: 'Fire' },
  { code: 'PARTY', emoji: '🎉', label: 'Celebration' },
  { code: 'SMILE', emoji: '😊', label: 'Smile' },
  { code: 'SPARKLES', emoji: '✨', label: 'Sparkles' },
  { code: 'WOW', emoji: '😮', label: 'Wow' },
  { code: 'THANKS', emoji: '🙏', label: 'Thanks' },
];

const REACTION_BY_CODE = new Map<string, ReactionPresentation>(
  REACTION_CATALOG.map((item) => [item.code, item]),
);

export function isBackendReaction(value: unknown): value is BackendReaction {
  return typeof value === 'string' && REACTION_BY_CODE.has(value);
}

export function emojiForReaction(code: BackendReaction): string {
  return REACTION_BY_CODE.get(code)?.emoji ?? '👍';
}

export function labelForReaction(code: BackendReaction): string {
  return REACTION_BY_CODE.get(code)?.label ?? 'Reaction';
}

export interface VoiceRoomDto {
  readonly id: string;
  readonly title: string;
  readonly topic?: string | null;
  readonly hostId: string;
  readonly targetLanguage: string;
  readonly nativeLanguage: string;
  readonly maxStageSeats: number;
  readonly speakers: readonly string[];
  readonly participantCount: number;
  readonly handRaiseCount: number;
  readonly createdAt?: string;
}

export interface RoomSessionDto {
  readonly room: VoiceRoomDto;
  readonly liveKitUrl: string;
  readonly liveKitToken: string;
  readonly role: BackendRoomRole;
  readonly canPublishAudio: boolean;
  readonly isChatMuted?: boolean;
  readonly isMutedByHost?: boolean;
  readonly snapshot?: RoomJoinSnapshot;
}

export interface ParticipantPreview {
  readonly userId: string;
  readonly displayName?: string | null;
  readonly avatarUrl?: string | null;
  readonly nativeLanguage?: string | null;
  readonly isReconnecting: boolean;
}

export interface AudiencePage {
  readonly audiencePreview: readonly ParticipantPreview[];
  readonly hasMoreAudience: boolean;
  readonly nextCursor: string | null;
}

export interface RoomJoinSnapshot {
  readonly speakers: readonly ParticipantPreview[];
  readonly audienceCount: number;
  readonly audience: AudiencePage;
  readonly handRaiseQueue: readonly string[];
  readonly chat: ChatStateDto;
}

export interface RoomSnapshotDto {
  readonly room: VoiceRoomDto;
  readonly role: BackendRoomRole;
  readonly snapshot: RoomJoinSnapshot;
}

export interface StageDto {
  readonly speakers: readonly string[];
  readonly handRaiseQueue: readonly string[];
}

export interface RoomCommentDto {
  readonly id: string;
  readonly authorId: string;
  readonly type: CommentType;
  readonly content: string;
  readonly correctedContent?: string;
  readonly pinnedAt?: string;
  readonly replyTo?: string;
  readonly createdAt: string;
}

export interface CommentReactionTallyDto {
  readonly counts: Readonly<Partial<Record<BackendReaction, number>>>;
  readonly mine: BackendReaction | null;
}

export interface ChatStateDto {
  readonly comments: readonly RoomCommentDto[];
  readonly topic: string | null;
  readonly muted: boolean;
  readonly mutedUsers: readonly string[];
  readonly reactions: readonly {
    readonly commentId: string;
    readonly counts: CommentReactionTallyDto['counts'];
    readonly mine?: BackendReaction | null;
  }[];
}

export interface CreateVoiceRoomPayload {
  readonly title: string;
  readonly topic?: string | null;
  readonly targetLanguage: string;
  readonly nativeLanguage: string;
  readonly maxStageSeats?: number;
}

export interface UpdateVoiceRoomPayload {
  readonly title?: string;
  readonly topic?: string;
  readonly maxStageSeats?: number;
}

export interface PostCommentPayload {
  readonly type: CommentType;
  readonly content: string;
  readonly correctedContent?: string | null;
  readonly replyTo?: string | null;
}

export interface ReactionBurstDto {
  readonly userId: string;
  readonly reaction: BackendReaction;
}

export type RoomRealtimeEvent =
  | {
      readonly type: 'STAGE_UPDATED' | 'HAND_RAISED' | 'HAND_LOWERED';
      readonly at: number;
      readonly stage: StageDto;
    }
  | { readonly type: 'SPEAKER_RECONNECTING' | 'SPEAKER_RECONNECTED'; readonly userId: string }
  | {
      readonly type: 'PRESENCE_CHANGED';
      readonly participantCount: number;
      readonly audienceCount?: number;
      readonly joined: readonly string[];
      readonly left: readonly string[];
    }
  | {
      readonly type: 'ROOM_UPDATED';
      readonly title: string;
      readonly topic: string;
      readonly maxStageSeats: number;
      readonly hostId?: string;
    }
  | { readonly type: 'REACTIONS'; readonly reactions: readonly ReactionBurstDto[] }
  | {
      readonly type: 'PARTICIPANT_PROFILE_UPDATED';
      readonly userId: string;
      readonly avatarUrl: string;
    };

export type ChatRealtimeEvent =
  | { readonly type: 'COMMENT_POSTED'; readonly comment: RoomCommentDto }
  | { readonly type: 'COMMENT_DELETED'; readonly commentId: string }
  | {
      readonly type: 'COMMENT_REACTED';
      readonly commentId: string;
      readonly userId: string;
      readonly reaction: BackendReaction | null;
      readonly previous: BackendReaction | null;
    }
  | { readonly type: 'COMMENT_PINNED'; readonly commentId: string }
  | { readonly type: 'COMMENT_UNPINNED'; readonly commentId: string | null }
  | { readonly type: 'CHAT_MUTED' | 'CHAT_UNMUTED'; readonly userId: string }
  | { readonly type: 'TOPIC_CHANGED'; readonly topic: string | null };
