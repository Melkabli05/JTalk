import { isPlatformBrowser } from '@angular/common';
import {
  computed,
  DestroyRef,
  inject,
  InjectionToken,
  linkedSignal,
  PLATFORM_ID,
  resource,
  Service,
  signal,
} from '@angular/core';
import type { Participant, TrackPublication } from 'livekit-client';
import { MIC_MUTED_STORAGE_KEY } from '../../../shared/constants/storage-keys.constants';
import {
  ChatRealtimeEvent,
  NetworkMode,
  RoomRealtimeEvent,
  RoomSessionDto,
} from '../../../shared/models/voice-room.model';
import {
  parseChatRealtimeEvent,
  parseRoomRealtimeEvent,
} from '../../../shared/data-access/voice-room-parsers';
import { CHAT_EVENTS_TOPIC, ROOM_EVENTS_TOPIC } from '../constants/room.constants';
import {
  attachKrispNoiseIsolation,
  KrispFilterController,
  NoiseIsolationMode,
} from './livekit-noise-filter';

export { CHAT_EVENTS_TOPIC, ROOM_EVENTS_TOPIC };

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

export interface NetworkModeChange {
  readonly mode: NetworkMode;
  readonly primarySids: readonly string[];
  readonly secondarySids: readonly string[];
}

export interface LiveKitRoomEventHandlers {
  readonly onRoomEnded?: (message: string) => void;
  readonly onReconnected?: () => void;
  readonly onRoomEvent?: (event: RoomRealtimeEvent) => void;
  readonly onChatEvent?: (event: ChatRealtimeEvent) => void;
  readonly onNetworkModeChange?: (change: NetworkModeChange) => void;
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

function decodeDataPayload(payload: Uint8Array): unknown {
  try {
    return JSON.parse(new TextDecoder().decode(payload));
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

  const reportMicState = (publication: TrackPublication, participant: Participant) => {
    if (publication.source === Track.Source.Microphone) {
      listener.onMicrophoneMuted(
        participant.identity,
        publication.isMuted,
        participant === room.localParticipant,
      );
    }
  };

  const collectRemoteAudioSids = () => {
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
        const event = parseRoomRealtimeEvent(decodeDataPayload(payload));
        if (event) listener.onRoomEvent(event);
      } else if (topic === CHAT_EVENTS_TOPIC) {
        const event = parseChatRealtimeEvent(decodeDataPayload(payload));
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

@Service()
export class LiveKitAudioEngine {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly connector = inject(LIVEKIT_CONNECTOR);
  private readonly destroyRef = inject(DestroyRef);

  private readonly eventHandlers = new Set<LiveKitRoomEventHandlers>();
  private readonly activeConnection = signal<LiveKitConnectionHandle | null>(null);
  private generation = 0;
  private currentRoomId: string | null = null;
  private lastReportedNetworkMode: NetworkMode = 'OPTIMAL';

  private readonly audioDevicesResource = resource({
    params: () => this.activeConnection() ?? undefined,
    defaultValue: [] as readonly AudioDeviceOption[],
    loader: async ({ params: connection, abortSignal }) => {
      try {
        const devices = await connection.listAudioInputDevices();
        return abortSignal.aborted ? [] : devices;
      } catch {
        // Device enumeration may require mic permission first
        return [];
      }
    },
  });

  readonly status = signal<LiveKitConnectionStatus>('idle');
  readonly canPublish = signal(false);
  readonly micOn = signal(false);
  readonly micError = signal<string | null>(null);
  readonly soundBlocked = signal(false);
  readonly speakingIds = signal<readonly string[]>([]);
  readonly mutedIds = signal<readonly string[]>([]);
  readonly connectionQuality = signal<AudioQualityLevel>('unknown');
  readonly lastNetworkModeChange = signal<NetworkModeChange | null>(null);
  readonly noiseIsolationEnabled = signal(true);
  readonly noiseIsolationMode = signal<NoiseIsolationMode>('webrtc-fallback');
  readonly audioInputDevices = computed<readonly AudioDeviceOption[]>(() =>
    this.audioDevicesResource.hasValue() ? this.audioDevicesResource.value() : [],
  );
  readonly selectedAudioInputId = linkedSignal<readonly AudioDeviceOption[], string | null>({
    source: () => this.audioInputDevices(),
    computation: (devices, previous) => previous?.value ?? devices[0]?.deviceId ?? null,
  });

  constructor() {
    this.destroyRef.onDestroy(() => {
      void this.disconnect();
    });
  }

  onEvents(handlers: LiveKitRoomEventHandlers): () => void {
    this.eventHandlers.add(handlers);
    return () => {
      this.eventHandlers.delete(handlers);
    };
  }

  async connect(session: RoomSessionDto): Promise<boolean> {
    if (!isPlatformBrowser(this.platformId)) {
      return false;
    }

    const gen = ++this.generation;
    this.currentRoomId = session.room.id;
    this.status.set('connecting');
    await this.closeCurrent();
    if (gen !== this.generation) return false;
    this.canPublish.set(session.canPublishAudio);
    this.lastReportedNetworkMode = 'OPTIMAL';

    try {
      const handle = await this.connector(
        session.liveKitUrl,
        session.liveKitToken,
        {
          initialNoiseIsolation: this.noiseIsolationEnabled(),
          preferredInputDeviceId: this.selectedAudioInputId(),
        },
        this.createListener(gen),
      );

      if (gen !== this.generation) {
        await handle.disconnect();
        return false;
      }

      this.activeConnection.set(handle);
      this.status.set('connected');
      if (this.canPublish()) {
        if (this.wasMicMutedFor(session.room.id)) {
          this.micOn.set(false);
        } else {
          await this.setMicrophone(true);
        }
      }
      return true;
    } catch {
      if (gen === this.generation) {
        this.canPublish.set(false);
        this.status.set('failed');
      }
      return false;
    }
  }

  async toggleMicrophone(): Promise<boolean> {
    if (!this.canPublish()) return false;
    return this.setMicrophone(!this.micOn());
  }

  async setMicrophone(enabled: boolean): Promise<boolean> {
    const connection = this.activeConnection();
    if (!connection || (enabled && !this.canPublish())) {
      this.micOn.set(false);
      return false;
    }
    try {
      await connection.setMicrophone(enabled);
      if (connection !== this.activeConnection()) return false;
      this.micOn.set(enabled && this.activeConnection() !== null);
      this.rememberMicMuted(this.currentRoomId, !enabled);
      this.micError.set(null);
      if (enabled) {
        this.refreshAudioInputDevices();
      }
      return true;
    } catch (err) {
      if (connection !== this.activeConnection()) return false;
      this.micOn.set(false);
      this.micError.set(
        err instanceof Error && err.message
          ? 'Microphone access was blocked or unavailable.'
          : 'Could not enable microphone.',
      );
      return false;
    }
  }

  async toggleNoiseIsolation(): Promise<NoiseIsolationMode> {
    const next = !this.noiseIsolationEnabled();
    this.noiseIsolationEnabled.set(next);
    const connection = this.activeConnection();
    if (connection) {
      const mode = await connection.setNoiseIsolation(next);
      if (connection === this.activeConnection() && next === this.noiseIsolationEnabled()) {
        this.noiseIsolationMode.set(mode);
      }
    }
    return this.noiseIsolationMode();
  }

  refreshAudioInputDevices(): void {
    if (this.activeConnection()) {
      this.audioDevicesResource.reload();
    }
  }

  async selectAudioInputDevice(deviceId: string): Promise<boolean> {
    const connection = this.activeConnection();
    if (!connection) {
      this.selectedAudioInputId.set(deviceId);
      return true;
    }
    try {
      await connection.selectAudioInputDevice(deviceId);
      if (connection !== this.activeConnection()) return false;
      this.selectedAudioInputId.set(deviceId);
      return true;
    } catch {
      return false;
    }
  }

  async enableAudio(): Promise<boolean> {
    const connection = this.activeConnection();
    if (!connection) return false;
    try {
      await connection.startAudio();
      if (connection !== this.activeConnection()) return false;
      this.soundBlocked.set(false);
      return true;
    } catch {
      return false;
    }
  }

  async disconnect(): Promise<void> {
    const gen = ++this.generation;
    this.currentRoomId = null;
    this.rememberMicMuted(null, false);
    await this.closeCurrent();
    if (gen === this.generation) this.status.set('idle');
  }

  private wasMicMutedFor(roomId: string): boolean {
    if (!isPlatformBrowser(this.platformId)) return false;
    try {
      return window.sessionStorage.getItem(MIC_MUTED_STORAGE_KEY) === roomId;
    } catch {
      return false;
    }
  }

  private rememberMicMuted(roomId: string | null, muted: boolean): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      if (muted && roomId) {
        window.sessionStorage.setItem(MIC_MUTED_STORAGE_KEY, roomId);
      } else {
        window.sessionStorage.removeItem(MIC_MUTED_STORAGE_KEY);
      }
    } catch {
      /* Ignore storage restrictions. */
    }
  }

  private async closeCurrent(): Promise<void> {
    const conn = this.activeConnection();
    this.activeConnection.set(null);
    this.micOn.set(false);
    this.micError.set(null);
    this.soundBlocked.set(false);
    this.speakingIds.set([]);
    this.mutedIds.set([]);
    this.canPublish.set(false);
    this.connectionQuality.set('unknown');
    this.lastNetworkModeChange.set(null);
    this.noiseIsolationMode.set('webrtc-fallback');
    if (conn) {
      try {
        await conn.disconnect();
      } catch {
        // Ignore teardown errors
      }
    }
  }

  private createListener(gen: number): LiveKitListener {
    const guard =
      <Args extends unknown[]>(fn: (...args: Args) => void) =>
      (...args: Args) => {
        if (gen === this.generation) fn(...args);
      };

    return {
      onActiveSpeakers: guard((ids) => this.speakingIds.set(ids)),
      onMicrophoneMuted: guard((identity, muted, isLocal) => {
        this.mutedIds.update((list) =>
          muted
            ? list.includes(identity)
              ? list
              : [...list, identity]
            : list.filter((id) => id !== identity),
        );
        if (isLocal) {
          this.micOn.set(!muted && this.activeConnection() !== null);
          this.rememberMicMuted(this.currentRoomId, muted);
        }
      }),
      onCanPublishChanged: guard((canPublish) => {
        if (canPublish === this.canPublish()) return;
        this.canPublish.set(canPublish);
        void this.setMicrophone(canPublish);
      }),
      onSoundBlocked: guard((blocked) => this.soundBlocked.set(blocked)),
      onLinkStatus: guard((status) => {
        const reconnected = status === 'connected' && this.status() === 'reconnecting';
        this.status.set(status);
        if (reconnected) {
          for (const h of [...this.eventHandlers]) h.onReconnected?.();
        }
      }),
      onConnectionQuality: guard((quality, tracks) => {
        this.connectionQuality.set(quality);
        const nextMode: NetworkMode =
          quality === 'poor' || quality === 'lost' ? 'LOW_BANDWIDTH' : 'OPTIMAL';
        if (nextMode !== this.lastReportedNetworkMode) {
          this.lastReportedNetworkMode = nextMode;
          const change: NetworkModeChange = {
            mode: nextMode,
            primarySids: tracks.primarySids,
            secondarySids: tracks.secondarySids,
          };
          this.lastNetworkModeChange.set(change);
          for (const h of [...this.eventHandlers]) h.onNetworkModeChange?.(change);
        }
      }),
      onNoiseIsolationMode: guard((mode) => this.noiseIsolationMode.set(mode)),
      onRoomEvent: guard((event) => {
        for (const h of [...this.eventHandlers]) h.onRoomEvent?.(event);
      }),
      onChatEvent: guard((event) => {
        for (const h of [...this.eventHandlers]) h.onChatEvent?.(event);
      }),
      onDisconnected: guard((terminalMessage?: string) => {
        this.activeConnection.set(null);
        this.micOn.set(false);
        this.speakingIds.set([]);
        this.mutedIds.set([]);
        this.canPublish.set(false);
        this.status.set('failed');
        if (terminalMessage) {
          for (const h of [...this.eventHandlers]) h.onRoomEnded?.(terminalMessage);
        }
      }),
    };
  }
}
