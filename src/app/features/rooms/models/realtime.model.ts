import type { ReactionBurst } from './reaction.model';
import type { Stage } from './room.model';

export type AudioStatus = 'idle' | 'connecting' | 'reconnecting' | 'connected' | 'failed';

export interface RealtimeListener {
  readonly speakersChanged: (ids: readonly string[]) => void;
  readonly roomEvent: (event: RoomUpdate) => void;
  readonly soundBlocked: (blocked: boolean) => void;
  readonly canPublishChanged: (canPublish: boolean) => void;
  readonly linkChanged: (up: boolean) => void;
  readonly microphoneMuted: (identity: string, muted: boolean, local: boolean) => void;
  readonly connectionLost: () => void;
}

export type RoomUpdate =
  | {
      readonly type: 'STAGE_UPDATED' | 'HAND_RAISED' | 'HAND_LOWERED';
      readonly at: number;
      readonly stage: Stage;
    }
  | { readonly type: 'SPEAKER_RECONNECTING' | 'SPEAKER_RECONNECTED'; readonly userId: string }
  | {
      readonly type: 'PRESENCE_CHANGED';
      readonly participantCount: number;
      readonly joined: readonly string[];
      readonly left: readonly string[];
    }
  | {
      readonly type: 'ROOM_UPDATED';
      readonly title: string;
      readonly topic: string;
      readonly maxStageSeats: number;
      /** Who hosts the room now; present when the room was handed over, absent when the host only edited it. */
      readonly hostId?: string;
    }
  | { readonly type: 'REACTIONS'; readonly reactions: readonly ReactionBurst[] };

export interface RealtimeConnection {
  readonly setMicrophone: (on: boolean) => Promise<void>;
  readonly startSound: () => Promise<void>;
  readonly disconnect: () => Promise<void>;
}

export type RealtimeConnector = (
  url: string,
  token: string,
  listener: RealtimeListener,
) => Promise<RealtimeConnection>;
