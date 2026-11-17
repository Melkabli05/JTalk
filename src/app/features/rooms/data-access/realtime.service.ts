import { DestroyRef, inject, Service, signal } from '@angular/core';
import { Subject } from 'rxjs';
import type {
  AudioStatus,
  RealtimeConnection,
  RealtimeListener,
  RoomUpdate,
} from '../models/realtime.model';
import type { RoomSession } from '../models/room.model';
import { REALTIME_CONNECTOR } from './realtime-connector.token';

@Service()
export class RealtimeService {
  private readonly connector = inject(REALTIME_CONNECTOR);
  private readonly pushed = new Subject<RoomUpdate>();
  private connection: RealtimeConnection | null = null;
  private generation = 0;

  readonly status = signal<AudioStatus>('idle');
  readonly canSpeak = signal(false);
  readonly micOn = signal(false);
  readonly micRefused = signal(false);
  readonly soundBlocked = signal(false);
  readonly speaking = signal<readonly string[]>([]);
  readonly roomEvents = this.pushed.asObservable();

  constructor() {
    inject(DestroyRef).onDestroy(() => void this.disconnect());
  }

  async connect(session: RoomSession): Promise<void> {
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

  async toggleMicrophone(): Promise<void> {
    if (this.canSpeak()) {
      await this.turnMicrophone(!this.micOn());
    }
  }

  async enableSound(): Promise<void> {
    const started = await this.connection?.startSound().then(
      () => true,
      () => false,
    );
    if (started) {
      this.soundBlocked.set(false);
    }
  }

  async disconnect(): Promise<void> {
    this.generation++;
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
      roomEvent: live((event) => this.pushed.next(event)),
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
