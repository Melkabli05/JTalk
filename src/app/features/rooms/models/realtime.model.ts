/** Where the room's audio connection stands. `failed` means it could not be made or was lost; the person may try again. */
export type AudioStatus = 'idle' | 'connecting' | 'connected' | 'failed';

/** What the audio connection tells the app about. Each call is one fact, so the app never reads the media library's events. */
export interface RealtimeListener {
  /** Who is speaking right now (user ids), loudest first. */
  readonly speakersChanged: (ids: readonly string[]) => void;
  /** The server pushed a room event (seats, hands, the room itself): the app should refetch. */
  readonly roomEvent: () => void;
  /** The browser refuses to play sound until the person taps something. */
  readonly soundBlocked: (blocked: boolean) => void;
  /** The server granted or took away the right to speak, with the person already connected. */
  readonly canPublishChanged: (canPublish: boolean) => void;
  /** The connection dropped and is being re-made (`false`), or came back (`true`). */
  readonly linkChanged: (up: boolean) => void;
  /** The connection ended for good, not by the app's own doing (removed, room closed, network gone). */
  readonly connectionLost: () => void;
}

export interface RealtimeConnection {
  /** Turns the microphone on or off. Rejects when the browser or the person refuses it. */
  readonly setMicrophone: (on: boolean) => Promise<void>;
  /** Starts sound playback. Must run inside a tap or click. */
  readonly startSound: () => Promise<void>;
  readonly disconnect: () => Promise<void>;
}

/** Connects to a room's audio. Resolves once connected, rejects when it cannot. */
export type RealtimeConnector = (
  url: string,
  token: string,
  listener: RealtimeListener,
) => Promise<RealtimeConnection>;
