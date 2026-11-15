import type {
  RealtimeConnection,
  RealtimeConnector,
  RealtimeListener,
} from '../models/realtime.model';

export class FakeRealtimeLink {
  readonly connections: {
    url: string;
    token: string;
    listener: RealtimeListener;
    microphone: boolean[];
    soundStarts: number;
    disconnected: boolean;
  }[] = [];
  connectFailure: Error | null = null;
  microphoneFailure: Error | null = null;
  soundFailure: Error | null = null;
  gate: Promise<void> | null = null;

  readonly connector: RealtimeConnector = async (url, token, listener) => {
    await this.gate;
    if (this.connectFailure) {
      throw this.connectFailure;
    }
    const record = {
      url,
      token,
      listener,
      microphone: [] as boolean[],
      soundStarts: 0,
      disconnected: false,
    };
    this.connections.push(record);
    const connection: RealtimeConnection = {
      setMicrophone: (on) => {
        if (this.microphoneFailure && on) {
          return Promise.reject(this.microphoneFailure);
        }
        record.microphone.push(on);
        return Promise.resolve();
      },
      startSound: () => {
        record.soundStarts++;
        return this.soundFailure ? Promise.reject(this.soundFailure) : Promise.resolve();
      },
      disconnect: () => {
        record.disconnected = true;
        return Promise.resolve();
      },
    };
    return connection;
  };

  get last() {
    return this.connections[this.connections.length - 1];
  }
}
