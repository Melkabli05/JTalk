export type AudioStatus = 'idle' | 'connecting' | 'reconnecting' | 'connected' | 'failed';

export interface RealtimeListener {
  readonly speakersChanged: (ids: readonly string[]) => void;
  readonly roomEvent: () => void;
  readonly soundBlocked: (blocked: boolean) => void;
  readonly canPublishChanged: (canPublish: boolean) => void;
  readonly linkChanged: (up: boolean) => void;
  readonly connectionLost: () => void;
}

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
