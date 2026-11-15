export type RoomRole = 'HOST' | 'SPEAKER' | 'LISTENER';

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

export interface RoomDraft {
  readonly title: string;
  readonly topic: string;
  readonly targetLanguage: string;
  readonly nativeLanguage: string;
  readonly maxStageSeats: number;
}

export interface RoomEdit {
  readonly title: string;
  readonly topic: string;
  readonly maxStageSeats: number;
}

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
