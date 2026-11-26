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
import { BrowserStorage } from '../../../core/services/browser-storage';
import { MIC_MUTED_STORAGE_KEY } from '../../../shared/constants/storage-keys.constants';
import type {
  ChatRealtimeEvent,
  NetworkMode,
  RoomRealtimeEvent,
  RoomSessionDto,
} from '../../../shared/models/voice-room.model';
import { CHAT_EVENTS_TOPIC, ROOM_EVENTS_TOPIC } from '../constants/room.constants';
import {
  attachKrispNoiseIsolation,
  type KrispFilterController,
  type NoiseIsolationMode,
} from './livekit-noise-filter';
import { VoiceRoomApi } from './voice-room-api';

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

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

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

@Service()
export class LiveKitAudioEngine {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly connector = inject(LIVEKIT_CONNECTOR);
  private readonly destroyRef = inject(DestroyRef);
  private readonly storage = inject(BrowserStorage);
  private readonly voiceRoomApi = inject(VoiceRoomApi, { optional: true });

  private readonly eventHandlers = new Set<LiveKitRoomEventHandlers>();
  private readonly activeConnection = signal<LiveKitConnectionHandle | null>(null);
  private generation = 0;
  private currentRoomId: string | null = null;
  private lastReportedNetworkMode: NetworkMode = 'OPTIMAL';
  private muteSyncTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly audioDevicesResource = resource<
    readonly AudioDeviceOption[],
    LiveKitConnectionHandle | undefined
  >({
    params: () => this.activeConnection() ?? undefined,
    defaultValue: [],
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

  private readonly statusState = signal<LiveKitConnectionStatus>('idle');
  private readonly canPublishState = signal(false);
  private readonly micOnState = signal(false);
  private readonly isMutedByHostState = signal(false);
  private readonly micErrorState = signal<string | null>(null);
  private readonly soundBlockedState = signal(false);
  private readonly speakingIdsState = signal<readonly string[]>([]);
  private readonly mutedIdsState = signal<readonly string[]>([]);
  private readonly connectionQualityState = signal<AudioQualityLevel>('unknown');
  private readonly lastNetworkModeChangeState = signal<NetworkModeChange | null>(null);
  private readonly noiseIsolationEnabledState = signal(true);
  private readonly noiseIsolationModeState = signal<NoiseIsolationMode>('webrtc-fallback');

  readonly status = this.statusState.asReadonly();
  readonly canPublish = this.canPublishState.asReadonly();
  readonly micOn = this.micOnState.asReadonly();
  readonly isMutedByHost = this.isMutedByHostState.asReadonly();
  readonly micError = this.micErrorState.asReadonly();
  readonly soundBlocked = this.soundBlockedState.asReadonly();
  readonly speakingIds = this.speakingIdsState.asReadonly();
  readonly mutedIds = this.mutedIdsState.asReadonly();
  readonly connectionQuality = this.connectionQualityState.asReadonly();
  readonly lastNetworkModeChange = this.lastNetworkModeChangeState.asReadonly();
  readonly noiseIsolationEnabled = this.noiseIsolationEnabledState.asReadonly();
  readonly noiseIsolationMode = this.noiseIsolationModeState.asReadonly();
  readonly audioInputDevices = computed<readonly AudioDeviceOption[]>(() =>
    this.audioDevicesResource.hasValue() ? this.audioDevicesResource.value() : [],
  );
  private readonly selectedAudioInputIdState = linkedSignal<
    readonly AudioDeviceOption[],
    string | null
  >({
    source: () => this.audioInputDevices(),
    computation: (devices, previous) => previous?.value ?? devices[0]?.deviceId ?? null,
  });
  readonly selectedAudioInputId = this.selectedAudioInputIdState.asReadonly();

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

  connectSession(session: RoomSessionDto, onDone?: (connected: boolean) => void): void {
    void this.connect(session).then((ok) => onDone?.(ok));
  }

  disconnectSession(onDone?: () => void): void {
    void this.disconnect().then(() => onDone?.());
  }

  toggleMic(onDone?: (ok: boolean) => void): void {
    void this.toggleMicrophone().then((ok) => onDone?.(ok));
  }

  toggleNoise(onDone?: (mode: NoiseIsolationMode) => void): void {
    void this.toggleNoiseIsolation().then((mode) => onDone?.(mode));
  }

  selectInputDevice(deviceId: string, onDone?: (ok: boolean) => void): void {
    void this.selectAudioInputDevice(deviceId).then((ok) => onDone?.(ok));
  }

  enableAudioPlayback(onDone?: (ok: boolean) => void): void {
    void this.enableAudio().then((ok) => onDone?.(ok));
  }

  async connect(session: RoomSessionDto): Promise<boolean> {
    if (!isPlatformBrowser(this.platformId)) {
      return false;
    }

    const gen = ++this.generation;
    this.currentRoomId = session.room.id;
    this.statusState.set('connecting');
    await this.closeCurrent();
    if (gen !== this.generation) return false;
    const mutedByHost = session.isMutedByHost ?? false;
    this.isMutedByHostState.set(mutedByHost);
    this.canPublishState.set(session.canPublishAudio && !mutedByHost);
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
      this.statusState.set('connected');
      const effectivelySelfMuted =
        session.isSelfMuted !== undefined
          ? session.isSelfMuted
          : this.wasMicMutedFor(session.room.id);
      const shouldEnableMic =
        this.canPublish() && !mutedByHost && !effectivelySelfMuted;
      if (shouldEnableMic) {
        await this.setMicrophone(true);
      } else {
        this.micOnState.set(false);
        if (session.isSelfMuted !== undefined) {
          this.rememberMicMuted(session.room.id, effectivelySelfMuted);
        }
      }
      return true;
    } catch {
      if (gen === this.generation) {
        this.canPublishState.set(false);
        this.statusState.set('failed');
      }
      return false;
    }
  }

  async toggleMicrophone(): Promise<boolean> {
    const roomId = this.currentRoomId;
    if (!this.canPublish() || this.isMutedByHost()) return false;
    const nextMicEnabled = !this.micOn();
    const ok = await this.setMicrophone(nextMicEnabled);
    if (ok && roomId) {
      this.scheduleSelfMuteSync(roomId, !nextMicEnabled);
    }
    return ok;
  }

  async setMicrophone(enabled: boolean): Promise<boolean> {
    const connection = this.activeConnection();
    if (!connection || (enabled && !this.canPublish())) {
      this.micOnState.set(false);
      return false;
    }
    try {
      await connection.setMicrophone(enabled);
      if (connection !== this.activeConnection()) return false;
      this.micOnState.set(enabled && this.activeConnection() !== null);
      this.rememberMicMuted(this.currentRoomId, !enabled);
      this.micErrorState.set(null);
      if (enabled) {
        this.refreshAudioInputDevices();
      }
      return true;
    } catch (err) {
      if (connection !== this.activeConnection()) return false;
      this.micOnState.set(false);
      this.micErrorState.set(
        err instanceof Error && err.message
          ? 'Microphone access was blocked or unavailable.'
          : 'Could not enable microphone.',
      );
      return false;
    }
  }

  async toggleNoiseIsolation(): Promise<NoiseIsolationMode> {
    const next = !this.noiseIsolationEnabled();
    this.noiseIsolationEnabledState.set(next);
    const connection = this.activeConnection();
    if (connection) {
      const mode = await connection.setNoiseIsolation(next);
      if (connection === this.activeConnection() && next === this.noiseIsolationEnabled()) {
        this.noiseIsolationModeState.set(mode);
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
      this.selectedAudioInputIdState.set(deviceId);
      return true;
    }
    try {
      await connection.selectAudioInputDevice(deviceId);
      if (connection !== this.activeConnection()) return false;
      this.selectedAudioInputIdState.set(deviceId);
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
      this.soundBlockedState.set(false);
      return true;
    } catch {
      return false;
    }
  }

  async disconnect(): Promise<void> {
    const gen = ++this.generation;
    const roomId = this.currentRoomId;
    this.currentRoomId = null;
    if (roomId) this.clearRoomMicPreference(roomId);
    await this.closeCurrent();
    if (gen === this.generation) this.statusState.set('idle');
  }

  clearRoomMicPreference(roomId: string): void {
    this.storage.remove('session', this.micStorageKey(roomId));
  }

  private micStorageKey(roomId: string): string {
    return `${MIC_MUTED_STORAGE_KEY}:${roomId}`;
  }

  private wasMicMutedFor(roomId: string): boolean {
    return this.storage.getJson('session', this.micStorageKey(roomId), isBoolean, false);
  }

  private rememberMicMuted(roomId: string | null, muted: boolean): void {
    if (!roomId) return;
    this.storage.setJson('session', this.micStorageKey(roomId), muted);
  }

  private scheduleSelfMuteSync(roomId: string, muted: boolean): void {
    this.clearMuteSyncTimer();
    this.muteSyncTimer = setTimeout(() => {
      this.muteSyncTimer = null;
      void this.syncSelfMuteToBackend(roomId, muted);
    }, 300);
  }

  private syncSelfMuteToBackend(roomId: string, muted: boolean): void {
    this.voiceRoomApi?.updateSelfMute(roomId, muted).subscribe({
      error: () => {
        // Non-fatal: local LiveKit track state remains authoritative for the active session
      },
    });
  }

  private clearMuteSyncTimer(): void {
    if (this.muteSyncTimer) {
      clearTimeout(this.muteSyncTimer);
      this.muteSyncTimer = null;
    }
  }

  private async closeCurrent(): Promise<void> {
    this.clearMuteSyncTimer();
    const conn = this.activeConnection();
    this.activeConnection.set(null);
    this.micOnState.set(false);
    this.isMutedByHostState.set(false);
    this.micErrorState.set(null);
    this.soundBlockedState.set(false);
    this.speakingIdsState.set([]);
    this.mutedIdsState.set([]);
    this.canPublishState.set(false);
    this.connectionQualityState.set('unknown');
    this.lastNetworkModeChangeState.set(null);
    this.noiseIsolationModeState.set('webrtc-fallback');
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
      (...args: Args): void => {
        if (gen === this.generation) fn(...args);
      };

    return {
      onActiveSpeakers: guard((ids) => this.speakingIdsState.set(ids)),
      onMicrophoneMuted: guard((identity, muted, isLocal) => {
        this.mutedIdsState.update((list): readonly string[] =>
          muted
            ? list.includes(identity)
              ? list
              : [...list, identity]
            : list.filter((id) => id !== identity),
        );
        if (isLocal) {
          this.micOnState.set(!muted && this.activeConnection() !== null);
          this.rememberMicMuted(this.currentRoomId, muted);
        }
      }),
      onCanPublishChanged: guard((canPublish) => {
        if (canPublish) {
          this.isMutedByHostState.set(false);
        }
        if (canPublish === this.canPublish()) return;
        this.canPublishState.set(canPublish);
        void this.setMicrophone(canPublish);
      }),
      onSoundBlocked: guard((blocked) => this.soundBlockedState.set(blocked)),
      onLinkStatus: guard((status) => {
        const reconnected = status === 'connected' && this.status() === 'reconnecting';
        this.statusState.set(status);
        if (reconnected) {
          for (const h of [...this.eventHandlers]) h.onReconnected?.();
        }
      }),
      onConnectionQuality: guard((quality, tracks) => {
        this.connectionQualityState.set(quality);
        const nextMode: NetworkMode =
          quality === 'poor' || quality === 'lost' ? 'LOW_BANDWIDTH' : 'OPTIMAL';
        if (nextMode !== this.lastReportedNetworkMode) {
          this.lastReportedNetworkMode = nextMode;
          const change: NetworkModeChange = {
            mode: nextMode,
            primarySids: tracks.primarySids,
            secondarySids: tracks.secondarySids,
          };
          this.lastNetworkModeChangeState.set(change);
          for (const h of [...this.eventHandlers]) h.onNetworkModeChange?.(change);
        }
      }),
      onNoiseIsolationMode: guard((mode) => this.noiseIsolationModeState.set(mode)),
      onRoomEvent: guard((event) => {
        for (const h of [...this.eventHandlers]) h.onRoomEvent?.(event);
      }),
      onChatEvent: guard((event) => {
        for (const h of [...this.eventHandlers]) h.onChatEvent?.(event);
      }),
      onDisconnected: guard((terminalMessage?: string) => {
        this.activeConnection.set(null);
        this.micOnState.set(false);
        this.speakingIdsState.set([]);
        this.mutedIdsState.set([]);
        this.canPublishState.set(false);
        this.statusState.set('failed');
        if (terminalMessage) {
          for (const h of [...this.eventHandlers]) h.onRoomEnded?.(terminalMessage);
        }
      }),
    };
  }
}
