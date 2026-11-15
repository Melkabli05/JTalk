import type { RealtimeListener } from '../models/realtime.model';
import { connectLiveKit, ROOM_EVENTS_TOPIC } from './livekit.connector';

const library = vi.hoisted(() => {
  type Handler = (...args: unknown[]) => void;
  const state = {
    rooms: [] as FakeRoom[],
    connectFailure: null as Error | null,
    canPlayback: true,
  };

  class FakeRoom {
    readonly handlers = new Map<string, Handler>();
    readonly localParticipant = {
      identity: 'me',
      permissions: { canPublish: false },
      setMicrophoneEnabled: vi.fn(),
    };
    canPlaybackAudio = state.canPlayback;
    readonly startAudio = vi.fn(() => Promise.resolve());
    readonly disconnect = vi.fn(() => {
      this.emit('disconnected');
      return Promise.resolve();
    });

    constructor() {
      state.rooms.push(this);
    }

    on(event: string, handler: Handler): this {
      this.handlers.set(event, handler);
      return this;
    }

    connect(): Promise<void> {
      return state.connectFailure ? Promise.reject(state.connectFailure) : Promise.resolve();
    }

    emit(event: string, ...args: unknown[]): void {
      this.handlers.get(event)?.(...args);
    }
  }
  return { state, FakeRoom };
});

vi.mock('livekit-client', () => ({
  Room: library.FakeRoom,
  RoomEvent: {
    TrackSubscribed: 'trackSubscribed',
    TrackUnsubscribed: 'trackUnsubscribed',
    ActiveSpeakersChanged: 'activeSpeakersChanged',
    DataReceived: 'dataReceived',
    AudioPlaybackStatusChanged: 'audioPlaybackChanged',
    ParticipantPermissionsChanged: 'participantPermissionsChanged',
    Reconnecting: 'reconnecting',
    Reconnected: 'reconnected',
    Disconnected: 'disconnected',
  },
  Track: { Kind: { Audio: 'audio' } },
}));

describe('connectLiveKit', () => {
  const listener = {
    speakersChanged: vi.fn(),
    roomEvent: vi.fn(),
    soundBlocked: vi.fn(),
    canPublishChanged: vi.fn(),
    linkChanged: vi.fn(),
    connectionLost: vi.fn(),
  } satisfies RealtimeListener;

  const room = () => library.state.rooms[library.state.rooms.length - 1];
  const server = new Uint8Array();

  beforeEach(() => {
    library.state.rooms.length = 0;
    library.state.connectFailure = null;
    library.state.canPlayback = true;
    Object.values(listener).forEach((fn) => fn.mockClear());
  });
  afterEach(() => document.body.replaceChildren());

  it('turns a room event from the backend into a refresh', async () => {
    await connectLiveKit('wss://x', 't', listener);

    room().emit('dataReceived', server, undefined, undefined, ROOM_EVENTS_TOPIC);

    expect(listener.roomEvent).toHaveBeenCalledOnce();
  });

  it('ignores a "room event" that came from another client, since only the backend may send one', async () => {
    await connectLiveKit('wss://x', 't', listener);

    room().emit('dataReceived', server, { identity: 'mallory' }, undefined, ROOM_EVENTS_TOPIC);

    expect(listener.roomEvent).not.toHaveBeenCalled();
  });

  it('ignores data on any other topic', async () => {
    await connectLiveKit('wss://x', 't', listener);

    room().emit('dataReceived', server, undefined, undefined, 'something-else');

    expect(listener.roomEvent).not.toHaveBeenCalled();
  });

  it('reports who is speaking by user id', async () => {
    await connectLiveKit('wss://x', 't', listener);

    room().emit('activeSpeakersChanged', [{ identity: 'h-1' }, { identity: 'b-1' }]);

    expect(listener.speakersChanged).toHaveBeenCalledWith(['h-1', 'b-1']);
  });

  it('reports a change of the right to speak, for this person only', async () => {
    await connectLiveKit('wss://x', 't', listener);
    const me = room().localParticipant;

    room().emit('participantPermissionsChanged', {}, { ...me, permissions: { canPublish: true } });
    expect(listener.canPublishChanged).not.toHaveBeenCalled();

    me.permissions = { canPublish: true };
    room().emit('participantPermissionsChanged', {}, me);
    expect(listener.canPublishChanged).toHaveBeenCalledExactlyOnceWith(true);
  });

  it('says whether sound can play, from the start and when that changes', async () => {
    library.state.canPlayback = false;
    await connectLiveKit('wss://x', 't', listener);
    expect(listener.soundBlocked).toHaveBeenLastCalledWith(true);

    room().emit('audioPlaybackChanged', true);
    expect(listener.soundBlocked).toHaveBeenLastCalledWith(false);
  });

  it('plays the audio it hears from hidden elements, and removes them when the track goes', async () => {
    await connectLiveKit('wss://x', 't', listener);
    const element = document.createElement('audio');
    const track = { kind: 'audio', attach: () => element, detach: () => [element] };

    room().emit('trackSubscribed', track);
    expect(document.body.contains(element)).toBe(true);
    expect(element.parentElement?.hidden).toBe(true);

    room().emit('trackUnsubscribed', track);
    expect(document.body.contains(element)).toBe(false);
  });

  it('reports a lost connection, but not one the app closed itself', async () => {
    const connection = await connectLiveKit('wss://x', 't', listener);

    room().emit('disconnected');
    expect(listener.connectionLost).toHaveBeenCalledOnce();

    await connection.disconnect();
    expect(listener.connectionLost).toHaveBeenCalledOnce();
  });

  it('turns the microphone on and off, and starts sound, through the room', async () => {
    const connection = await connectLiveKit('wss://x', 't', listener);

    await connection.setMicrophone(true);
    await connection.startSound();

    expect(room().localParticipant.setMicrophoneEnabled).toHaveBeenCalledWith(true);
    expect(room().startAudio).toHaveBeenCalledOnce();
  });

  it('fails, and leaves nothing in the page, when it cannot connect', async () => {
    library.state.connectFailure = new Error('unreachable');

    await expect(connectLiveKit('wss://x', 't', listener)).rejects.toThrow('unreachable');

    expect(document.body.children).toHaveLength(0);
  });
});
