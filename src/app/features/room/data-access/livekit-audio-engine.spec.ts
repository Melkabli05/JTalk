import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { RoomSessionDto } from '../../../shared/models/voice-room.model';
import { VoiceRoomApi } from './voice-room-api';
import { LiveKitAudioEngine } from './livekit-audio-engine';
import {
  LIVEKIT_CONNECTOR,
  type LiveKitConnectionHandle,
  type LiveKitConnectorFn,
  type LiveKitListener,
} from './livekit-connector';

describe('LiveKitAudioEngine', () => {
  const session: RoomSessionDto = {
    room: {
      id: 'room-1',
      title: 'Live Practice',
      topic: 'Greetings',
      hostId: 'u-host',
      targetLanguage: 'es',
      nativeLanguage: 'en',
      maxStageSeats: 6,
      speakers: ['u-host'],
      participantCount: 1,
      handRaiseCount: 0,
    },
    liveKitUrl: 'wss://jtalk-eimd2bul.livekit.cloud',
    liveKitToken: 'tok-123',
    role: 'HOST',
    canPublishAudio: true,
  };

  function setupMockConnector() {
    let capturedListener!: LiveKitListener;
    const handle: LiveKitConnectionHandle = {
      setMicrophone: vi.fn().mockResolvedValue(undefined),
      setNoiseIsolation: vi.fn().mockImplementation(async (on: boolean) =>
        on ? 'krisp-active' : 'krisp-bypassed',
      ),
      selectAudioInputDevice: vi.fn().mockResolvedValue(undefined),
      listAudioInputDevices: vi
        .fn()
        .mockResolvedValue([{ deviceId: 'mic-1', label: 'Studio USB Mic' }]),
      startAudio: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
    };

    const connector: LiveKitConnectorFn = vi.fn(async (_url, _token, _opts, listener) => {
      capturedListener = listener;
      return handle;
    });

    const updateSelfMute = vi.fn().mockReturnValue(of(undefined));

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        LiveKitAudioEngine,
        { provide: LIVEKIT_CONNECTOR, useValue: connector },
        { provide: VoiceRoomApi, useValue: { updateSelfMute } },
      ],
    });

    return {
      engine: TestBed.inject(LiveKitAudioEngine),
      handle,
      connector,
      updateSelfMute,
      getListener: () => capturedListener,
    };
  }

  it('connects, enables mic for publishers, toggles Krisp noise isolation, and switches devices', async () => {
    const { engine, handle, getListener } = setupMockConnector();

    const ok = await engine.connect(session);
    expect(ok).toBe(true);
    expect(engine.status()).toBe('connected');
    expect(engine.micOn()).toBe(true);
    expect(handle.setMicrophone).toHaveBeenCalledWith(true);

    // Krisp active -> toggle off -> bypassed
    getListener().onNoiseIsolationMode('krisp-active');
    expect(engine.noiseIsolationMode()).toBe('krisp-active');

    const modeAfterToggle = await engine.toggleNoiseIsolation();
    expect(modeAfterToggle).toBe('krisp-bypassed');
    expect(engine.noiseIsolationEnabled()).toBe(false);

    // Device switching
    engine.refreshAudioInputDevices();
    TestBed.tick();
    await vi.waitFor(() => expect(engine.audioInputDevices()).toHaveLength(1));
    await engine.selectAudioInputDevice('mic-1');
    expect(handle.selectAudioInputDevice).toHaveBeenCalledWith('mic-1');
  });

  it('syncs server-side remote mute, autoplay unlock, and LOW_BANDWIDTH network mode reporting', async () => {
    const { engine, handle, getListener } = setupMockConnector();
    await engine.connect(session);

    // Host server-side mute reflects immediately on local mic state
    getListener().onMicrophoneMuted('u-host', true, true);
    expect(engine.micOn()).toBe(false);

    // Browser autoplay blocked -> enableAudio clears blocked flag
    getListener().onSoundBlocked(true);
    expect(engine.soundBlocked()).toBe(true);
    await engine.enableAudio();
    expect(handle.startAudio).toHaveBeenCalledTimes(1);
    expect(engine.soundBlocked()).toBe(false);

    // Connection quality drop updates lastNetworkModeChange signal and notifies handlers
    const emissions: string[] = [];
    const unbind = engine.onEvents({ onNetworkModeChange: (e) => emissions.push(e.mode) });
    getListener().onConnectionQuality('poor', {
      primarySids: ['TR_1'],
      secondarySids: ['TR_2'],
    });
    expect(engine.lastNetworkModeChange()?.mode).toBe('LOW_BANDWIDTH');
    expect(emissions).toEqual(['LOW_BANDWIDTH']);
    unbind();

    await engine.disconnect();
    expect(handle.disconnect).toHaveBeenCalled();
    expect(engine.status()).toBe('idle');
  });

  it('ignores completed playback work from a disconnected room', async () => {
    const { engine, handle, getListener } = setupMockConnector();
    let finishPlayback!: () => void;
    vi.mocked(handle.startAudio).mockImplementationOnce(() => new Promise<void>((resolve) => {
      finishPlayback = resolve;
    }));
    await engine.connect(session);
    const playback = engine.enableAudio();
    await engine.disconnect();
    finishPlayback();

    expect(await playback).toBe(false);
    expect(engine.status()).toBe('idle');
    getListener().onSoundBlocked(true);
    expect(engine.soundBlocked()).toBe(false);
  });

  it('keeps mic muted across page refresh in the same room and resets on disconnect', async () => {
    window.sessionStorage.clear();
    const { engine, handle } = setupMockConnector();
    await engine.connect(session);
    expect(engine.micOn()).toBe(true);

    await engine.setMicrophone(false);
    expect(engine.micOn()).toBe(false);

    vi.mocked(handle.setMicrophone).mockClear();
    await engine.connect(session);
    expect(handle.setMicrophone).not.toHaveBeenCalledWith(true);
    expect(engine.micOn()).toBe(false);

    await engine.disconnect();
    await engine.connect(session);
    expect(handle.setMicrophone).toHaveBeenCalledWith(true);
    expect(engine.micOn()).toBe(true);
  });

  it('respects backend isMutedByHost on reconnect even if sessionStorage was not muted', async () => {
    window.sessionStorage.clear();
    const { engine, handle } = setupMockConnector();
    await engine.connect({ ...session, canPublishAudio: false, isMutedByHost: true });

    expect(engine.isMutedByHost()).toBe(true);
    expect(engine.canPublish()).toBe(false);
    expect(engine.micOn()).toBe(false);
    expect(handle.setMicrophone).not.toHaveBeenCalledWith(true);
    expect(await engine.toggleMicrophone()).toBe(false);
  });

  it('respects backend isSelfMuted on reconnect while keeping canPublish true', async () => {
    window.sessionStorage.clear();
    const { engine, handle } = setupMockConnector();
    await engine.connect({ ...session, canPublishAudio: true, isSelfMuted: true });

    expect(engine.canPublish()).toBe(true);
    expect(engine.isMutedByHost()).toBe(false);
    expect(engine.micOn()).toBe(false);
    expect(handle.setMicrophone).not.toHaveBeenCalledWith(true);
  });

  it('debounces self-mute backend sync by 300ms on rapid mic toggles', async () => {
    vi.useFakeTimers();
    try {
      window.sessionStorage.clear();
      const { engine, updateSelfMute } = setupMockConnector();
      await engine.connect(session);

      await engine.toggleMicrophone();
      await engine.toggleMicrophone();
      await engine.toggleMicrophone();
      expect(updateSelfMute).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(300);
      expect(updateSelfMute).toHaveBeenCalledTimes(1);
      expect(updateSelfMute).toHaveBeenCalledWith('room-1', true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('clears isMutedByHost and allows mic toggling once publish permission is restored', async () => {
    window.sessionStorage.clear();
    const { engine, handle, getListener } = setupMockConnector();
    await engine.connect({ ...session, canPublishAudio: false, isMutedByHost: true });
    expect(engine.isMutedByHost()).toBe(true);
    expect(await engine.toggleMicrophone()).toBe(false);

    getListener().onCanPublishChanged(true);
    await vi.waitFor(() => expect(engine.micOn()).toBe(true));

    expect(engine.isMutedByHost()).toBe(false);
    expect(engine.canPublish()).toBe(true);
    expect(handle.setMicrophone).toHaveBeenCalledWith(true);
    expect(await engine.toggleMicrophone()).toBe(true);
    expect(engine.micOn()).toBe(false);
  });

  it('honors explicit backend isSelfMuted=false over stale sessionStorage mute state', async () => {
    window.sessionStorage.clear();
    const { engine, handle } = setupMockConnector();
    await engine.connect(session);
    await engine.setMicrophone(false);
    vi.mocked(handle.setMicrophone).mockClear();

    await engine.connect({ ...session, canPublishAudio: true, isSelfMuted: false });
    expect(handle.setMicrophone).toHaveBeenCalledWith(true);
    expect(engine.micOn()).toBe(true);
  });
});
