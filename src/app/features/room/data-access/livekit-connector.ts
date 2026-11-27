import { InjectionToken } from '@angular/core';
import type { Participant, TrackPublication } from 'livekit-client';
import type { ChatRealtimeEvent, RoomRealtimeEvent } from '../../../shared/models/voice-room.model';
import { CHAT_EVENTS_TOPIC, ROOM_EVENTS_TOPIC } from '../constants/room.constants';
import {
  attachKrispNoiseIsolation,
  type KrispFilterController,
  type NoiseIsolationMode,
} from './livekit-noise-filter';

export type LiveKitConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'failed';

export type AudioQualityLevel = 'unknown' | 'excellent' | 'good' | 'poor' | 'lost';

export interface AudioDeviceOption {
  readonly deviceId: string;
  readonly label: string;
}

export interface LiveKitListener {
  readonly onActiveSpeakers: (identities: readonly string[]) => void;
  readonly onMicrophoneMuted: (identity: string, muted: boolean, isLocal: boolean) => void;
  readonly onCanPublishChanged: (canPublish: boolean) => void;
  readonly onSoundBlocked: (blocked: boolean) => void;
  readonly onLinkStatus: (status: LiveKitConnectionStatus) => void;
  readonly onConnectionQuality: (
    quality: AudioQualityLevel,
    trackSnapshot: {
      primarySids: readonly string[];
      secondarySids: readonly string[];
    },
  ) => void;
  readonly onNoiseIsolationMode: (mode: NoiseIsolationMode) => void;
  readonly onRoomEvent: (event: RoomRealtimeEvent) => void;
  readonly onChatEvent: (event: ChatRealtimeEvent) => void;
  readonly onDisconnected: (terminalMessage?: string) => void;
}

export interface LiveKitConnectionHandle {
  setMicrophone(enabled: boolean): Promise<void>;
  setNoiseIsolation(enabled: boolean): Promise<NoiseIsolationMode>;
  selectAudioInputDevice(deviceId: string): Promise<void>;
  listAudioInputDevices(): Promise<readonly AudioDeviceOption[]>;
  startAudio(): Promise<void>;
  disconnect(): Promise<void>;
}

export type LiveKitConnectorFn = (
  url: string,
  token: string,
  options: {
    initialNoiseIsolation: boolean;
    preferredInputDeviceId: string | null;
  },
  listener: LiveKitListener,
) => Promise<LiveKitConnectionHandle>;

const ROOM_EVENT_TYPES = new Set<string>([
  'STAGE_UPDATED',
  'HAND_RAISED',
  'HAND_LOWERED',
  'SPEAKER_RECONNECTING',
  'SPEAKER_RECONNECTED',
  'PRESENCE_CHANGED',
  'ROOM_UPDATED',
  'REACTIONS',
  'PARTICIPANT_PROFILE_UPDATED',
  'COMMENT_PINNED',
  'COMMENT_UNPINNED',
]);

const CHAT_EVENT_TYPES = new Set<string>([
  'COMMENT_POSTED',
  'COMMENT_DELETED',
  'COMMENT_REACTED',
  'COMMENT_PINNED',
  'COMMENT_UNPINNED',
  'CHAT_MUTED',
  'CHAT_UNMUTED',
  'TOPIC_CHANGED',
]);

function isRoomRealtimeEvent(value: unknown): value is RoomRealtimeEvent {
  if (typeof value !== 'object' || value === null) return false;
  const type: unknown = Reflect.get(value, 'type');
  return typeof type === 'string' && ROOM_EVENT_TYPES.has(type);
}

function isChatRealtimeEvent(value: unknown): value is ChatRealtimeEvent {
  if (typeof value !== 'object' || value === null) return false;
  const type: unknown = Reflect.get(value, 'type');
  return typeof type === 'string' && CHAT_EVENT_TYPES.has(type);
}

function decodeDataEvent<T>(
  payload: Uint8Array,
  guard: (value: unknown) => value is T,
): T | undefined {
  try {
    const parsed: unknown = JSON.parse(new TextDecoder().decode(payload));
    return guard(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export async function defaultLiveKitConnector(
  url: string,
  token: string,
  options: {
    initialNoiseIsolation: boolean;
    preferredInputDeviceId: string | null;
  },
  listener: LiveKitListener,
): Promise<LiveKitConnectionHandle> {
  const { ConnectionQuality, DisconnectReason, Room, RoomEvent, Track } =
    await import('livekit-client');

  const room = new Room({
    adaptiveStream: true,
    dynacast: true,
    audioCaptureDefaults: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      ...(options.preferredInputDeviceId ? { deviceId: options.preferredInputDeviceId } : {}),
    },
  });

  const audioHost = document.createElement('div');
  audioHost.hidden = true;
  audioHost.setAttribute('data-jtalk-audio-host', 'true');
  document.body.append(audioHost);

  let closing = false;
  let publicationGeneration = 0;
  let noiseController: KrispFilterController | null = null;
  let desiredNoiseIsolation = options.initialNoiseIsolation;
  let lastActiveSpeakerIds = new Set<string>();

  const reportMicState = (publication: TrackPublication, participant: Participant): void => {
    if (publication.source === Track.Source.Microphone) {
      listener.onMicrophoneMuted(
        participant.identity,
        publication.isMuted,
        participant === room.localParticipant,
      );
    }
  };

  const collectRemoteAudioSids = (): { primarySids: string[]; secondarySids: string[] } => {
    const primarySids: string[] = [];
    const secondarySids: string[] = [];
    for (const participant of room.remoteParticipants.values()) {
      for (const pub of participant.audioTrackPublications.values()) {
        if (!pub.trackSid) continue;
        if (lastActiveSpeakerIds.has(participant.identity) || primarySids.length < 2) {
          primarySids.push(pub.trackSid);
        } else {
          secondarySids.push(pub.trackSid);
        }
      }
    }
    return { primarySids, secondarySids };
  };

  const mapQuality = (
    q: (typeof ConnectionQuality)[keyof typeof ConnectionQuality],
  ): AudioQualityLevel => {
    switch (q) {
      case ConnectionQuality.Excellent:
        return 'excellent';
      case ConnectionQuality.Good:
        return 'good';
      case ConnectionQuality.Poor:
        return 'poor';
      case ConnectionQuality.Lost:
        return 'lost';
      default:
        return 'unknown';
    }
  };

  room
    .on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
      if (track.kind === Track.Kind.Audio) {
        audioHost.append(track.attach());
      }
      reportMicState(publication, participant);
    })
    .on(RoomEvent.TrackMuted, reportMicState)
    .on(RoomEvent.TrackUnmuted, reportMicState)
    .on(RoomEvent.TrackUnsubscribed, (track) => {
      for (const element of track.detach()) {
        element.remove();
      }
    })
    .on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
      const ids = speakers.map((p) => p.identity);
      lastActiveSpeakerIds = new Set(ids);
      listener.onActiveSpeakers(ids);
    })
    .on(RoomEvent.DataReceived, (payload, participant, _kind, topic) => {
      if (participant !== undefined) return;
      if (topic === ROOM_EVENTS_TOPIC) {
        const event = decodeDataEvent(payload, isRoomRealtimeEvent);
        if (event) listener.onRoomEvent(event);
      } else if (topic === CHAT_EVENTS_TOPIC) {
        const event = decodeDataEvent(payload, isChatRealtimeEvent);
        if (event) listener.onChatEvent(event);
      }
    })
    .on(RoomEvent.LocalTrackPublished, (publication) => {
      const micTrack = publication.audioTrack;
      if (publication.source !== Track.Source.Microphone || !micTrack) return;
      const publicationId = ++publicationGeneration;
      void (async () => {
        const controller = await attachKrispNoiseIsolation(micTrack, desiredNoiseIsolation);
        if (publicationId !== publicationGeneration || closing) {
          void controller.dispose();
          return;
        }
        noiseController = controller;
        listener.onNoiseIsolationMode(controller.mode);
      })();
    })
    .on(RoomEvent.LocalTrackUnpublished, (publication) => {
      if (publication.source === Track.Source.Microphone) ++publicationGeneration;
      if (publication.source === Track.Source.Microphone && noiseController) {
        void noiseController.dispose();
        noiseController = null;
      }
    })
    .on(RoomEvent.AudioPlaybackStatusChanged, (canPlayback) => {
      listener.onSoundBlocked(!canPlayback);
    })
    .on(RoomEvent.ParticipantPermissionsChanged, (_prev, participant) => {
      if (participant === room.localParticipant) {
        listener.onCanPublishChanged(participant.permissions?.canPublish ?? false);
      }
    })
    .on(RoomEvent.ConnectionQualityChanged, (quality, participant) => {
      if (participant === room.localParticipant) {
        listener.onConnectionQuality(mapQuality(quality), collectRemoteAudioSids());
      }
    })
    .on(RoomEvent.Reconnecting, () => listener.onLinkStatus('reconnecting'))
    .on(RoomEvent.Reconnected, () => listener.onLinkStatus('connected'))
    .on(RoomEvent.Disconnected, (reason) => {
      ++publicationGeneration;
      audioHost.remove();
      if (noiseController) {
        void noiseController.dispose();
        noiseController = null;
      }
      if (!closing) {
        const message =
          reason === DisconnectReason.ROOM_DELETED
            ? 'This room has ended.'
            : reason === DisconnectReason.PARTICIPANT_REMOVED
              ? 'You were removed from this room.'
              : undefined;
        listener.onDisconnected(message);
      }
    });

  try {
    await room.connect(url, token);
  } catch (err) {
    closing = true;
    try {
      await room.disconnect();
    } catch {
      // Ignore disconnect error during failed connect cleanup
    }
    audioHost.remove();
    throw err;
  }

  listener.onSoundBlocked(!room.canPlaybackAudio);
  return {
    setMicrophone: async (enabled: boolean) => {
      await room.localParticipant.setMicrophoneEnabled(enabled, {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        ...(options.preferredInputDeviceId ? { deviceId: options.preferredInputDeviceId } : {}),
      });
    },
    setNoiseIsolation: async (enabled: boolean) => {
      desiredNoiseIsolation = enabled;
      if (!noiseController) {
        return enabled ? 'webrtc-fallback' : 'krisp-bypassed';
      }
      const mode = await noiseController.setEnabled(enabled);
      listener.onNoiseIsolationMode(mode);
      return mode;
    },
    selectAudioInputDevice: async (deviceId: string) => {
      if (!(await room.switchActiveDevice('audioinput', deviceId))) {
        throw new Error('Microphone switch failed.');
      }
      options.preferredInputDeviceId = deviceId;
    },
    listAudioInputDevices: async () => {
      const devices = await Room.getLocalDevices('audioinput', false);
      return devices.map((d, index) => ({
        deviceId: d.deviceId,
        label: d.label.trim() || `Microphone ${index + 1}`,
      }));
    },
    startAudio: () => room.startAudio(),
    disconnect: async () => {
      closing = true;
      if (noiseController) {
        await noiseController.dispose();
        noiseController = null;
      }
      try {
        await room.disconnect();
      } finally {
        audioHost.remove();
      }
    },
  };
}

export const LIVEKIT_CONNECTOR = new InjectionToken<LiveKitConnectorFn>('LIVEKIT_CONNECTOR', {
  providedIn: 'root',
  factory: () => defaultLiveKitConnector,
});
