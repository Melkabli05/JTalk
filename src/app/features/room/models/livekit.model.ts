import type {
  ChatRealtimeEvent,
  NetworkMode,
  RoomRealtimeEvent,
} from '../../../shared/models/voice-room.model';

export type NoiseIsolationMode =
  'krisp-active' | 'krisp-bypassed' | 'webrtc-fallback' | 'unsupported';

export interface KrispFilterController {
  readonly mode: NoiseIsolationMode;
  setEnabled(enabled: boolean): Promise<NoiseIsolationMode>;
  dispose(): Promise<void>;
}

export type LiveKitConnectionStatus =
  'idle' | 'connecting' | 'connected' | 'reconnecting' | 'failed';

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
