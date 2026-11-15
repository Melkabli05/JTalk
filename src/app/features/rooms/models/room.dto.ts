/** The backend's wire format for voice rooms (`/api/v1/voice-rooms`). */

export interface VoiceRoomDto {
  readonly id: string;
  readonly title: string;
  readonly topic: string | null;
  readonly hostId: string;
  readonly targetLanguage: string;
  readonly nativeLanguage: string;
  readonly maxStageSeats: number;
  readonly speakers: readonly string[];
  readonly participantCount: number;
  readonly handRaiseCount: number;
}

export interface RoomSessionDto {
  readonly room: VoiceRoomDto;
  readonly canPublishAudio: boolean;
  readonly liveKitUrl: string;
  readonly liveKitToken: string;
}

export interface StageDto {
  readonly speakers: readonly string[];
  readonly handRaiseQueue: readonly string[];
}

export interface ParticipantDto {
  readonly userId: string;
  readonly status: 'ACTIVE' | 'RECONNECTING';
}
