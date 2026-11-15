import { TestBed } from '@angular/core/testing';
import type { RoomSession } from '../models/room.model';
import { REALTIME_CONNECTOR } from './realtime-connector.token';
import { FakeRealtimeLink } from './realtime-link.fake';
import { RealtimeService } from './realtime.service';

const SESSION: RoomSession = {
  room: {
    id: 'r-1',
    title: 'T',
    topic: '',
    hostId: 'h-1',
    targetLanguage: 'es',
    nativeLanguage: 'en',
    maxStageSeats: 4,
    speakers: [],
    participantCount: 0,
    handRaiseCount: 0,
  },
  canPublishAudio: false,
  liveKitUrl: 'wss://livekit.test',
  liveKitToken: 'token-1',
};
const SPEAKER: RoomSession = { ...SESSION, canPublishAudio: true };

describe('RealtimeService', () => {
  function setup() {
    const link = new FakeRealtimeLink();
    TestBed.configureTestingModule({
      providers: [{ provide: REALTIME_CONNECTOR, useValue: link.connector }, RealtimeService],
    });
    return { link, audio: TestBed.inject(RealtimeService) };
  }

  it('connects with the address and token from the session', async () => {
    const { link, audio } = setup();
    expect(audio.status()).toBe('idle');

    const connecting = audio.connect(SESSION);
    expect(audio.status()).toBe('connecting');
    await connecting;

    expect(audio.status()).toBe('connected');
    expect(link.last).toMatchObject({ url: 'wss://livekit.test', token: 'token-1' });
  });

  it('keeps a listener quiet: no microphone is asked for, and nothing can be unmuted', async () => {
    const { link, audio } = setup();
    await audio.connect(SESSION);

    expect(audio.canSpeak()).toBe(false);
    expect(audio.micOn()).toBe(false);
    await audio.toggleMicrophone();
    expect(link.last.microphone).toEqual([]);
    expect(audio.micOn()).toBe(false);
  });

  it('opens the microphone of someone who may speak, and lets them mute and unmute', async () => {
    const { link, audio } = setup();
    await audio.connect(SPEAKER);

    expect(audio.canSpeak()).toBe(true);
    expect(audio.micOn()).toBe(true);

    await audio.toggleMicrophone();
    expect(audio.micOn()).toBe(false);
    await audio.toggleMicrophone();
    expect(audio.micOn()).toBe(true);
    expect(link.last.microphone).toEqual([true, false, true]);
  });

  it('says so when the microphone is refused, and tries again on the next unmute', async () => {
    const { link, audio } = setup();
    link.microphoneFailure = new Error('NotAllowedError');
    await audio.connect(SPEAKER);

    expect(audio.status()).toBe('connected');
    expect(audio.micOn()).toBe(false);
    expect(audio.micRefused()).toBe(true);

    link.microphoneFailure = null;
    await audio.toggleMicrophone();
    expect(audio.micOn()).toBe(true);
    expect(audio.micRefused()).toBe(false);
  });

  it('turns the microphone on when the server gives a listener a seat, and off when it takes it back', async () => {
    const { link, audio } = setup();
    await audio.connect(SESSION);

    link.last.listener.canPublishChanged(true);
    await Promise.resolve();
    expect(audio.canSpeak()).toBe(true);
    expect(audio.micOn()).toBe(true);

    link.last.listener.canPublishChanged(false);
    await Promise.resolve();
    expect(audio.canSpeak()).toBe(false);
    expect(audio.micOn()).toBe(false);
  });

  it('reports who is speaking', async () => {
    const { link, audio } = setup();
    await audio.connect(SESSION);

    link.last.listener.speakersChanged(['h-1', 'b-1']);
    expect(audio.speaking()).toEqual(['h-1', 'b-1']);
    link.last.listener.speakersChanged([]);
    expect(audio.speaking()).toEqual([]);
  });

  it('passes on what the server announces about the room', async () => {
    const { link, audio } = setup();
    const heard = vi.fn();
    audio.roomEvents.subscribe(heard);
    await audio.connect(SESSION);

    link.last.listener.roomEvent();
    link.last.listener.roomEvent();

    expect(heard).toHaveBeenCalledTimes(2);
  });

  it('asks for a tap when the browser blocks sound, and starts it from that tap', async () => {
    const { link, audio } = setup();
    await audio.connect(SESSION);
    expect(audio.soundBlocked()).toBe(false);

    link.last.listener.soundBlocked(true);
    expect(audio.soundBlocked()).toBe(true);

    await audio.enableSound();
    expect(link.last.soundStarts).toBe(1);
    expect(audio.soundBlocked()).toBe(false);
  });

  it('keeps asking for the tap when starting the sound did not work', async () => {
    const { link, audio } = setup();
    await audio.connect(SESSION);
    link.last.listener.soundBlocked(true);
    link.soundFailure = new Error('blocked');

    await audio.enableSound();

    expect(audio.soundBlocked()).toBe(true);
  });

  it('shows connecting while the link is being re-made, and connected again after', async () => {
    const { link, audio } = setup();
    await audio.connect(SESSION);

    link.last.listener.linkChanged(false);
    expect(audio.status()).toBe('connecting');
    link.last.listener.linkChanged(true);
    expect(audio.status()).toBe('connected');
  });

  it('fails, rather than pretending, when it cannot connect, and connects on retry', async () => {
    const { link, audio } = setup();
    link.connectFailure = new Error('unreachable');
    await audio.connect(SPEAKER);

    expect(audio.status()).toBe('failed');
    expect(audio.micOn()).toBe(false);

    link.connectFailure = null;
    await audio.retry();
    expect(audio.status()).toBe('connected');
    expect(audio.micOn()).toBe(true);
  });

  it('fails when the connection is lost for good, and clears who was speaking', async () => {
    const { link, audio } = setup();
    await audio.connect(SPEAKER);
    link.last.listener.speakersChanged(['h-1']);

    link.last.listener.connectionLost();

    expect(audio.status()).toBe('failed');
    expect(audio.micOn()).toBe(false);
    expect(audio.speaking()).toEqual([]);
  });

  it('disconnects, and forgets everything, when asked', async () => {
    const { link, audio } = setup();
    await audio.connect(SPEAKER);
    link.last.listener.speakersChanged(['h-1']);

    await audio.disconnect();

    expect(link.last.disconnected).toBe(true);
    expect(audio.status()).toBe('idle');
    expect(audio.micOn()).toBe(false);
    expect(audio.speaking()).toEqual([]);
    await audio.retry();
    expect(link.connections).toHaveLength(1);
  });

  it('closes the old connection when it connects again', async () => {
    const { link, audio } = setup();
    await audio.connect(SESSION);
    const first = link.last;

    await audio.connect(SPEAKER);

    expect(first.disconnected).toBe(true);
    expect(link.connections).toHaveLength(2);
  });

  it('drops a connection that finishes after the person already left', async () => {
    const { link, audio } = setup();
    let open!: () => void;
    link.gate = new Promise<void>((resolve) => (open = resolve));

    const connecting = audio.connect(SPEAKER);
    await audio.disconnect();
    open();
    await connecting;

    expect(link.last.disconnected).toBe(true);
    expect(audio.status()).toBe('idle');
    expect(audio.micOn()).toBe(false);
  });

  it('ignores news from a connection it has replaced', async () => {
    const { link, audio } = setup();
    await audio.connect(SESSION);
    const old = link.last.listener;
    await audio.connect(SESSION);

    old.speakersChanged(['ghost']);
    old.connectionLost();

    expect(audio.speaking()).toEqual([]);
    expect(audio.status()).toBe('connected');
  });

  it('disconnects when the page that provides it goes away', async () => {
    const { link, audio } = setup();
    await audio.connect(SESSION);

    TestBed.resetTestingModule();
    await Promise.resolve();

    expect(link.last.disconnected).toBe(true);
    void audio;
  });
});
