import { DestroyRef, inject, Service, signal } from '@angular/core';
import { Subject } from 'rxjs';
import type { AudioStatus, RealtimeConnection, RealtimeListener } from '../models/realtime.model';
import type { RoomSession } from '../models/room.model';
import { REALTIME_CONNECTOR } from './realtime-connector.token';

/**
 * The audio of one room: connects with the session the backend gave, keeps the microphone in step with the right to
 * speak (which the server grants and takes away while connected), and reports who is speaking and when the server
 * announces a change in the room. Provide it per room page: it disconnects when the page goes away.
 */
@Service()
export class RealtimeService {
  private readonly connector = inject(REALTIME_CONNECTOR);
  private readonly pushed = new Subject<void>();
  private connection: RealtimeConnection | null = null;
  private session: RoomSession | null = null;
  /** Counts connections, so a slow one that finishes after the person left or retried cannot take over. */
  private generation = 0;

  readonly status = signal<AudioStatus>('idle');
  /** Can speak: the server lets this person publish. */
  readonly canSpeak = signal(false);
  readonly micOn = signal(false);
  /** The microphone was asked for and refused (no permission, no device). */
  readonly micRefused = signal(false);
  readonly soundBlocked = signal(false);
  readonly speaking = signal<readonly string[]>([]);
  /** Emits when the server says something changed in the room. */
  readonly roomEvents = this.pushed.asObservable();

  constructor() {
    inject(DestroyRef).onDestroy(() => void this.disconnect());
  }

  async connect(session: RoomSession): Promise<void> {
    this.session = session;
    const generation = ++this.generation;
    this.status.set('connecting');
    await this.close();
    this.canSpeak.set(session.canPublishAudio);
    try {
      const connection = await this.connector(
        session.liveKitUrl,
        session.liveKitToken,
        this.listenerFor(generation),
      );
      if (generation !== this.generation) {
        await connection.disconnect();
        return;
      }
      this.connection = connection;
      this.status.set('connected');
      if (this.canSpeak()) {
        await this.turnMicrophone(true);
      }
    } catch {
      if (generation === this.generation) {
        this.status.set('failed');
      }
    }
  }

  /** Tries again with the session last used, e.g. after the connection was lost. */
  async retry(): Promise<void> {
    if (this.session) {
      await this.connect(this.session);
    }
  }

  async toggleMicrophone(): Promise<void> {
    if (this.canSpeak()) {
      await this.turnMicrophone(!this.micOn());
    }
  }

  async enableSound(): Promise<void> {
    try {
      await this.connection?.startSound();
      this.soundBlocked.set(false);
    } catch {
      // still blocked: the button stays, and the next tap tries again
    }
  }

  async disconnect(): Promise<void> {
    this.generation++;
    this.session = null;
    await this.close();
    this.status.set('idle');
  }

  private async close(): Promise<void> {
    const connection = this.connection;
    this.connection = null;
    this.micOn.set(false);
    this.micRefused.set(false);
    this.soundBlocked.set(false);
    this.speaking.set([]);
    this.canSpeak.set(false);
    await connection?.disconnect().catch(() => undefined);
  }

  private async turnMicrophone(on: boolean): Promise<void> {
    try {
      await this.connection?.setMicrophone(on);
      this.micOn.set(on && this.connection !== null);
      this.micRefused.set(false);
    } catch {
      this.micOn.set(false);
      this.micRefused.set(on);
    }
  }

  /** What the connection reports, ignored once a newer connection has replaced it. */
  private listenerFor(generation: number): RealtimeListener {
    const live = <Args extends unknown[]>(handle: (...args: Args) => void) => {
      return (...args: Args) => {
        if (generation === this.generation) {
          handle(...args);
        }
      };
    };
    return {
      speakersChanged: live((ids) => this.speaking.set(ids)),
      roomEvent: live(() => this.pushed.next()),
      soundBlocked: live((blocked) => this.soundBlocked.set(blocked)),
      canPublishChanged: live((canPublish) => {
        this.canSpeak.set(canPublish);
        void this.turnMicrophone(canPublish);
      }),
      linkChanged: live((up) => this.status.set(up ? 'connected' : 'reconnecting')),
      connectionLost: live(() => {
        this.connection = null;
        this.micOn.set(false);
        this.speaking.set([]);
        this.status.set('failed');
      }),
    };
  }
}
