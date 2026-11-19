import type { RealtimeListener } from '../models/realtime.model';
import { CHAT_TOPIC, connectLiveKit, ROOM_EVENTS_TOPIC } from './livekit.connector';

const library = vi.hoisted(() => {
  type Handler = (...args: unknown[]) => void;
  const state = {
    rooms: [] as FakeRoom[],
    connectFailure: null as Error | null,
    canPlayback: true,
  };
  const noise = { supported: true, processor: { name: 'noise-filter' } };

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
  return { state, noise, FakeRoom };
});

vi.mock('livekit-client', () => ({
  Room: library.FakeRoom,
  RoomEvent: {
    TrackSubscribed: 'trackSubscribed',
    TrackUnsubscribed: 'trackUnsubscribed',
    ActiveSpeakersChanged: 'activeSpeakersChanged',
    LocalTrackPublished: 'localTrackPublished',
    TrackMuted: 'trackMuted',
    TrackUnmuted: 'trackUnmuted',
    DataReceived: 'dataReceived',
    AudioPlaybackStatusChanged: 'audioPlaybackChanged',
    ParticipantPermissionsChanged: 'participantPermissionsChanged',
    Reconnecting: 'reconnecting',
    Reconnected: 'reconnected',
    Disconnected: 'disconnected',
  },
  Track: {
    Kind: { Audio: 'audio' },
    Source: { Microphone: 'microphone', ScreenShare: 'screen_share' },
  },
}));

vi.mock('@livekit/krisp-noise-filter', () => ({
  isKrispNoiseFilterSupported: () => library.noise.supported,
  KrispNoiseFilter: () => library.noise.processor,
}));

describe('connectLiveKit', () => {
  const listener = {
    speakersChanged: vi.fn(),
    roomEvent: vi.fn(),
    chatEvent: vi.fn(),
    soundBlocked: vi.fn(),
    canPublishChanged: vi.fn(),
    linkChanged: vi.fn(),
    microphoneMuted: vi.fn(),
    connectionLost: vi.fn(),
  } satisfies RealtimeListener;

  const room = () => library.state.rooms[library.state.rooms.length - 1];
  const server = new Uint8Array();

  beforeEach(() => {
    library.state.rooms.length = 0;
    library.state.connectFailure = null;
    library.noise.supported = true;
    library.state.canPlayback = true;
    Object.values(listener).forEach((fn) => fn.mockClear());
  });
  afterEach(() => document.body.replaceChildren());

  const message = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));
  const stageEvent = {
    type: 'HAND_RAISED',
    roomId: 'r-1',
    targetUserId: 'b-1',
    timestamp: '2026-11-17T10:00:00.250Z',
    stage: { speakers: ['h-1'], handRaiseQueue: ['b-1'] },
  };

  it('hands the update a backend event carries to the listener', async () => {
    await connectLiveKit('wss://x', 't', listener);

    room().emit('dataReceived', message(stageEvent), undefined, undefined, ROOM_EVENTS_TOPIC);

    expect(listener.roomEvent).toHaveBeenCalledExactlyOnceWith({
      type: 'HAND_RAISED',
      at: Date.parse('2026-11-17T10:00:00.250Z'),
      stage: { speakers: ['h-1'], handRaiseQueue: ['b-1'] },
    });
  });

  it('hands a chat change the backend sends on the chat topic to the listener, and keeps the topics apart', async () => {
    await connectLiveKit('wss://x', 't', listener);
    const deletion = { type: 'COMMENT_DELETED', commentId: 'c-1' };

    room().emit('dataReceived', message(deletion), undefined, undefined, CHAT_TOPIC);
    room().emit('dataReceived', message(deletion), undefined, undefined, ROOM_EVENTS_TOPIC);
    room().emit('dataReceived', message(stageEvent), undefined, undefined, CHAT_TOPIC);

    expect(listener.chatEvent).toHaveBeenCalledExactlyOnceWith({
      type: 'COMMENT_DELETED',
      commentId: 'c-1',
    });
    expect(listener.roomEvent).not.toHaveBeenCalled();
  });

  it('does not trust a chat change that a participant sent', async () => {
    await connectLiveKit('wss://x', 't', listener);

    room().emit(
      'dataReceived',
      message({ type: 'COMMENT_DELETED', commentId: 'c-1' }),
      { identity: 'someone' },
      undefined,
      CHAT_TOPIC,
    );

    expect(listener.chatEvent).not.toHaveBeenCalled();
  });

  it('ignores a backend message it cannot understand', async () => {
    await connectLiveKit('wss://x', 't', listener);

    room().emit('dataReceived', server, undefined, undefined, ROOM_EVENTS_TOPIC);
    room().emit(
      'dataReceived',
      message({ type: 'SOMETHING_NEW' }),
      undefined,
      undefined,
      ROOM_EVENTS_TOPIC,
    );
    room().emit(
      'dataReceived',
      message({ ...stageEvent, stage: null }),
      undefined,
      undefined,
      ROOM_EVENTS_TOPIC,
    );

    expect(listener.roomEvent).not.toHaveBeenCalled();
  });

  it('ignores a "room event" that came from another client, since only the backend may send one', async () => {
    await connectLiveKit('wss://x', 't', listener);

    room().emit(
      'dataReceived',
      message(stageEvent),
      { identity: 'mallory' },
      undefined,
      ROOM_EVENTS_TOPIC,
    );

    expect(listener.roomEvent).not.toHaveBeenCalled();
  });

  it('ignores data on any other topic', async () => {
    await connectLiveKit('wss://x', 't', listener);

    room().emit('dataReceived', message(stageEvent), undefined, undefined, 'something-else');

    expect(listener.roomEvent).not.toHaveBeenCalled();
  });

  describe('noise filter', () => {
    const publication = (source: string, setProcessor = vi.fn(() => Promise.resolve())) => ({
      source,
      audioTrack: { setProcessor },
    });
    const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

    it('cleans up the microphone of the person who is speaking', async () => {
      await connectLiveKit('wss://x', 't', listener);
      const mic = publication('microphone');

      room().emit('localTrackPublished', mic);

      await vi.waitFor(() =>
        expect(mic.audioTrack.setProcessor).toHaveBeenCalledExactlyOnceWith(
          library.noise.processor,
        ),
      );
    });

    it('leaves any other published track alone', async () => {
      await connectLiveKit('wss://x', 't', listener);
      const screen = publication('screen_share');

      room().emit('localTrackPublished', screen);
      await settle();

      expect(screen.audioTrack.setProcessor).not.toHaveBeenCalled();
    });

    it('keeps the plain microphone when the browser cannot run the filter', async () => {
      library.noise.supported = false;
      await connectLiveKit('wss://x', 't', listener);
      const mic = publication('microphone');

      room().emit('localTrackPublished', mic);
      await settle();

      expect(mic.audioTrack.setProcessor).not.toHaveBeenCalled();
    });

    it('keeps the plain microphone when the filter will not start', async () => {
      await connectLiveKit('wss://x', 't', listener);
      const mic = publication(
        'microphone',
        vi.fn(() => Promise.reject(new Error('no licence'))),
      );

      room().emit('localTrackPublished', mic);

      await vi.waitFor(() => expect(mic.audioTrack.setProcessor).toHaveBeenCalledOnce());
      await settle();
    });
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

    room().emit('trackSubscribed', track, { source: 'unknown' }, { identity: 'b-1' });
    expect(document.body.contains(element)).toBe(true);
    expect(element.parentElement?.hidden).toBe(true);

    room().emit('trackUnsubscribed', track);
    expect(document.body.contains(element)).toBe(false);
  });

  describe('microphones', () => {
    const publication = (muted: boolean, source = 'microphone') => ({ source, isMuted: muted });

    it('says whose microphone is muted or open, as it changes, and which one is mine', async () => {
      await connectLiveKit('wss://x', 't', listener);

      room().emit('trackMuted', publication(true), { identity: 'b-1' });
      expect(listener.microphoneMuted).toHaveBeenLastCalledWith('b-1', true, false);

      room().emit('trackUnmuted', publication(false), { identity: 'b-1' });
      expect(listener.microphoneMuted).toHaveBeenLastCalledWith('b-1', false, false);

      room().emit('trackMuted', publication(true), room().localParticipant);
      expect(listener.microphoneMuted).toHaveBeenLastCalledWith('me', true, true);
    });

    it('says it from the start for someone whose microphone was already muted when it was heard', async () => {
      await connectLiveKit('wss://x', 't', listener);
      const track = {
        kind: 'audio',
        attach: () => document.createElement('audio'),
        detach: () => [],
      };

      room().emit('trackSubscribed', track, publication(true), { identity: 'b-1' });

      expect(listener.microphoneMuted).toHaveBeenLastCalledWith('b-1', true, false);
    });

    it('ignores anything that is not a microphone', async () => {
      await connectLiveKit('wss://x', 't', listener);
      listener.microphoneMuted.mockClear();

      room().emit('trackMuted', publication(true, 'screen_share'), { identity: 'b-1' });

      expect(listener.microphoneMuted).not.toHaveBeenCalled();
    });
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
