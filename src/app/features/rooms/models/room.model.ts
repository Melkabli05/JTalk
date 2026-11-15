export type MemberRole = 'HOST' | 'SPEAKER' | 'LISTENER';

export interface Room {
  readonly id: string;
  readonly title: string;
  readonly topic: string;
  readonly hostId: string;
  readonly targetLanguage: string;
  readonly nativeLanguage: string;
  readonly maxStageSeats: number;
  readonly speakers: readonly string[];
  readonly participantCount: number;
  readonly handRaiseCount: number;
}

/** What the person fills in to open a room. */
export interface RoomDraft {
  readonly title: string;
  readonly topic: string;
  readonly targetLanguage: string;
  readonly nativeLanguage: string;
  readonly maxStageSeats: number;
}

/** What the host may change about a room that is already open. */
export interface RoomEdit {
  readonly title: string;
  readonly topic: string;
  readonly maxStageSeats: number;
}

/** What the backend hands over on entering a room: the room, the rights, and where and how to connect to its audio. */
export interface RoomSession {
  readonly room: Room;
  readonly canPublishAudio: boolean;
  readonly liveKitUrl: string;
  readonly liveKitToken: string;
}

export interface Stage {
  readonly speakers: readonly string[];
  readonly handRaiseQueue: readonly string[];
}

export interface Participant {
  readonly userId: string;
  readonly reconnecting: boolean;
}

/** Someone shown on screen. The backend knows users by id only; names come from the identity layer, when it has them. */
export interface Member {
  readonly id: string;
  readonly name: string;
  readonly nativeLanguage: string;
  readonly learning: string;
  readonly avatar: string;
}
