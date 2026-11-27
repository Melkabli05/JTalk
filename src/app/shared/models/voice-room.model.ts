export type BackendRoomRole = 'HOST' | 'MODERATOR' | 'SPEAKER' | 'LISTENER';

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

export interface RoomSpeakerSummary {
  readonly id: string;
  readonly username?: string | null;
  readonly displayName?: string | null;
  readonly avatarUrl?: string | null;
  readonly countryCode?: string | null;
  readonly nativeLanguage?: string | null;
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
  readonly host?: RoomSpeakerSummary | null;
  readonly speakerProfiles?: readonly RoomSpeakerSummary[] | null;
  readonly participantProfiles?: readonly RoomSpeakerSummary[] | null;
}

export interface RoomSessionDto {
  readonly room: VoiceRoomDto;
  readonly mediaUrl: string;
  readonly mediaToken: string;
  readonly role: BackendRoomRole;
  readonly canPublishAudio: boolean;
  readonly isChatMuted?: boolean;
  readonly isSelfMuted?: boolean;
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
  readonly moderators?: readonly string[];
}

export interface RoomCommentDto {
  readonly id: string;
  readonly authorId: string;
  readonly type: CommentType;
  readonly content: string;
  readonly correctedContent?: string;
  readonly tip?: string;
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
  readonly tip?: string | null;
}

export interface ReactionBurstDto {
  readonly userId: string;
  readonly reaction: BackendReaction;
}

export interface RoomRealtimeEvent {
  readonly type:
    | 'STAGE_UPDATED'
    | 'HAND_RAISED'
    | 'HAND_LOWERED'
    | 'SPEAKER_RECONNECTING'
    | 'SPEAKER_RECONNECTED'
    | 'PRESENCE_CHANGED'
    | 'ROOM_UPDATED'
    | 'REACTIONS'
    | 'PARTICIPANT_PROFILE_UPDATED'
    | 'COMMENT_PINNED'
    | 'COMMENT_UNPINNED'
    | 'HOST_RECONNECTING'
    | 'HOST_RECONNECTED'
    | 'HOST_TRANSFERRED'
    | 'ROOM_IDLE_WARNING';
  readonly roomId?: string;
  readonly targetUserId?: string | null;
  readonly timestamp?: string;
  readonly stage?: StageDto | null;
  readonly presence?: {
    readonly participantCount: number;
    readonly audienceCount?: number;
    readonly joined: readonly string[];
    readonly left: readonly string[];
  } | null;
  readonly reactions?: readonly ReactionBurstDto[] | null;
  readonly settings?: {
    readonly title: string;
    readonly topic?: string | null;
    readonly maxStageSeats: number;
    readonly hostId?: string;
  } | null;
  readonly profileUpdate?: {
    readonly userId: string;
    readonly avatarUrl: string;
  } | null;
  readonly commentId?: string | null;
}

export interface ChatRealtimeEvent {
  readonly type:
    | 'COMMENT_POSTED'
    | 'COMMENT_DELETED'
    | 'COMMENT_REACTED'
    | 'COMMENT_PINNED'
    | 'COMMENT_UNPINNED'
    | 'CHAT_MUTED'
    | 'CHAT_UNMUTED'
    | 'TOPIC_CHANGED';
  readonly roomId?: string;
  readonly timestamp?: string;
  readonly comment?: RoomCommentDto | null;
  readonly commentId?: string | null;
  readonly targetUserId?: string | null;
  readonly topic?: string | null;
  readonly reaction?: BackendReaction | null;
  readonly previous?: BackendReaction | null;
}
