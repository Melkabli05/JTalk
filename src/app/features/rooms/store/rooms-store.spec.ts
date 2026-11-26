import { HttpEventType, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { IdentityStore } from '../../../core/auth/identity';
import { httpErrorInterceptor } from '../../../core/http/http-error.interceptor';
import { roomFeedTransport } from '../data-access/room-feed-transport';
import { RoomsStore } from './rooms-store';

describe('RoomsStore', () => {
  const signedIn = signal(true);
  const feedUrl = '/api/v1/voice-rooms/feed';
  const listUrl = '/api/v1/voice-rooms?size=100&expand=speakers';
  const room = {
    id: 'room',
    hostId: 'host',
    title: 'Practice',
    topic: '',
    targetLanguage: 'ar',
    nativeLanguage: 'en',
    maxStageSeats: 8,
    participantCount: 1,
    handRaiseCount: 0,
    speakers: ['host'],
    host: { id: 'host', displayName: 'Host', username: 'host', avatarUrl: null },
    speakerProfiles: [{ id: 'host', displayName: 'Host', username: 'host', avatarUrl: null }],
  };

  const flushResources = async (): Promise<void> => {
    TestBed.tick();
    await Promise.resolve();
    TestBed.tick();
  };

  beforeEach(() => {
    signedIn.set(true);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([httpErrorInterceptor, roomFeedTransport])),
        provideHttpClientTesting(),
        {
          provide: IdentityStore,
          useValue: {
            isAuthenticated: signedIn,
          },
        },
      ],
    });
  });

  it('updates room stats and embedded speakerProfiles in place without batch user lookups', () => {
    const store = TestBed.inject(RoomsStore);
    store.applyFeedEvent({ type: 'SNAPSHOT', rooms: [{ ...room, speakers: [], speakerProfiles: [] }] });
    expect(store.rooms()[0]?.speakers).toEqual([]);
    expect(store.rooms()[0]?.host?.displayName).toBe('Host');

    const updatedProfiles = [
      { id: 'a', displayName: 'Amira', username: 'amira', avatarUrl: '/avatars/a.jpg' },
      { id: 'b', displayName: 'Benoit', username: 'benoit', avatarUrl: null },
    ];
    store.applyFeedEvent({
      type: 'ROOM_STATS',
      roomId: room.id,
      live: { speakers: ['a', 'b'], participantCount: 5, handRaiseCount: 1 },
      speakerProfiles: updatedProfiles,
    });
    expect(store.rooms()[0]?.speakers).toEqual(['a', 'b']);
    expect(store.rooms()[0]?.participantCount).toBe(5);
    expect(store.rooms()[0]?.speakerProfiles).toEqual(updatedProfiles);
  });

  it('reconnects SSE feed and REST refresh with ?targetLanguage= when filter changes', async () => {
    const store = TestBed.inject(RoomsStore);
    const http = TestBed.inject(HttpTestingController);
    store.ensureLoaded();
    await flushResources();

    const allFeed = http.expectOne(feedUrl);
    store.setTargetLanguage('ja');
    await flushResources();

    expect(allFeed.cancelled).toBe(true);
    const jaFeed = http.expectOne(`${feedUrl}?targetLanguage=ja`);
    const snapshot = `data: ${JSON.stringify({ type: 'SNAPSHOT', rooms: [{ ...room, id: 'ja-1', targetLanguage: 'ja' }] })}\n\n`;
    jaFeed.event({
      type: HttpEventType.DownloadProgress,
      loaded: snapshot.length,
      partialText: snapshot,
    });
    await flushResources();
    expect(store.rooms().map((r) => r.id)).toEqual(['ja-1']);

    const refreshing = store.refresh();
    http
      .expectOne(`${listUrl}&targetLanguage=ja`)
      .flush({ content: [{ ...room, id: 'ja-2', targetLanguage: 'ja' }] });
    expect(await refreshing).toBe(true);
    expect(store.rooms().map((r) => r.id)).toEqual(['ja-2']);

    signedIn.set(false);
    await flushResources();
    expect(jaFeed.cancelled).toBe(true);
    http.verify();
  });

  it('discards a REST list superseded by a live room event', async () => {
    const store = TestBed.inject(RoomsStore);
    const http = TestBed.inject(HttpTestingController);
    store.applyFeedEvent({ type: 'SNAPSHOT', rooms: [room] });
    const refreshing = store.refresh();
    const request = http.expectOne(listUrl);
    store.applyFeedEvent({ type: 'ROOM_CLOSED', roomId: room.id });
    request.flush({ content: [room] });
    expect(await refreshing).toBe(false);
    expect(store.rooms()).toEqual([]);
    expect(store.loading()).toBe(false);
    http.verify();
  });

  it('loads rooms across all languages on refresh and cancels the feed on sign-out', async () => {
    const store = TestBed.inject(RoomsStore);
    const http = TestBed.inject(HttpTestingController);
    const spanishRoom = { ...room, id: 'room-es', targetLanguage: 'es', title: 'Café Español' };
    const refreshing = store.refresh();

    http.expectOne(listUrl).flush({ content: [room, spanishRoom] });
    expect(await refreshing).toBe(true);

    expect(store.rooms().map((item) => item.id)).toEqual(['room', 'room-es']);
    expect(store.liveCount()).toBe(2);
    await flushResources();
    const feed = http.expectOne(feedUrl);
    signedIn.set(false);
    await flushResources();
    expect(feed.cancelled).toBe(true);
    http.verify();
  });

  it('keeps the existing directory if a REST response has the wrong shape', async () => {
    const store = TestBed.inject(RoomsStore);
    const http = TestBed.inject(HttpTestingController);
    store.applyFeedEvent({ type: 'SNAPSHOT', rooms: [room] });

    const refreshing = store.refresh();
    http.expectOne(listUrl).flush({ content: null });
    expect(await refreshing).toBe(false);

    expect(store.rooms().map(({ id }) => id)).toEqual([room.id]);
    expect(store.error()).toBeTruthy();
    http.verify();
  });

  it('waits for a complete snapshot and discards an incomplete final event', async () => {
    const store = TestBed.inject(RoomsStore);
    const http = TestBed.inject(HttpTestingController);
    store.ensureLoaded();
    await flushResources();
    const feed = http.expectOne(feedUrl);
    const progress = (partialText: string) => {
      feed.event({
        type: HttpEventType.DownloadProgress,
        loaded: partialText.length,
        partialText,
      });
      TestBed.tick();
    };
    const invalidJson = 'data: {broken}\n\n';
    const earlyDelta = `data: ${JSON.stringify({ type: 'ROOM_OPENED', room })}\n\n`;
    const snapshot = `data: ${JSON.stringify({ type: 'SNAPSHOT', rooms: [room] })}\r\n\r`;
    const firstChunk = invalidJson + earlyDelta + snapshot;
    progress(firstChunk);
    expect(store.hasLoaded()).toBe(false);
    expect(store.rooms()).toEqual([]);

    const secondChunk = `${firstChunk}\ndata: ${JSON.stringify({ type: 'ROOM_CLOSED', roomId: room.id })}\n`;
    progress(secondChunk);
    expect(store.hasLoaded()).toBe(true);
    expect(store.rooms().map(({ id }) => id)).toEqual([room.id]);
    feed.flush(secondChunk);
    await flushResources();
    expect(store.rooms().map(({ id }) => id)).toEqual([room.id]);

    http.expectOne(listUrl).flush({ content: [room] });
    await flushResources();
    http.verify();
  });

  it('cancels the HTTP stream on sign-out', async () => {
    const store = TestBed.inject(RoomsStore);
    const http = TestBed.inject(HttpTestingController);
    store.ensureLoaded();
    await flushResources();
    const feed = http.expectOne({ method: 'GET', url: feedUrl });
    expect(feed.request.headers.get('Accept')).toBe('text/event-stream');
    expect(feed.request.transferCache).toBe(false);
    signedIn.set(false);
    await flushResources();
    expect(feed.cancelled).toBe(true);
    http.verify();
  });

  it('starts the REST fallback immediately after a network failure', async () => {
    const store = TestBed.inject(RoomsStore);
    const http = TestBed.inject(HttpTestingController);
    store.ensureLoaded();
    await flushResources();
    http.expectOne(feedUrl).error(new ProgressEvent('error'));
    await flushResources();
    http.expectOne(listUrl).flush({ content: [room] });
    await flushResources();
    expect(store.rooms().map((item) => item.id)).toEqual([room.id]);
    http.verify();
  });

  it('falls back if the server pings without sending its initial snapshot', async () => {
    vi.useFakeTimers();
    try {
      const store = TestBed.inject(RoomsStore);
      const http = TestBed.inject(HttpTestingController);
      store.ensureLoaded();
      await flushResources();
      const feed = http.expectOne(feedUrl);
      await vi.advanceTimersByTimeAsync(20_000);
      const ping = 'event: ping\ndata:\n\n';
      feed.event({ type: HttpEventType.DownloadProgress, loaded: ping.length, partialText: ping });
      await vi.advanceTimersByTimeAsync(5_000);
      await flushResources();
      expect(feed.cancelled).toBe(true);
      http.expectOne(listUrl).flush({ content: [room] });
      await flushResources();
      expect(store.hasLoaded()).toBe(true);
      http.verify();
    } finally {
      TestBed.resetTestingModule();
      vi.useRealTimers();
    }
  });

  it('keeps the stream open for server pings and falls back when bytes stop arriving', async () => {
    vi.useFakeTimers();
    try {
      const store = TestBed.inject(RoomsStore);
      const http = TestBed.inject(HttpTestingController);
      store.ensureLoaded();
      await flushResources();
      const feed = http.expectOne(feedUrl);
      let partialText = `data: ${JSON.stringify({ type: 'SNAPSHOT', rooms: [room] })}\n\n`;
      const progress = () => {
        feed.event({
          type: HttpEventType.DownloadProgress,
          loaded: partialText.length,
          partialText,
        });
        TestBed.tick();
      };
      progress();
      for (let tick = 0; tick < 3; tick++) {
        await vi.advanceTimersByTimeAsync(20_000);
        partialText += 'event: ping\ndata:\n\n';
        progress();
      }
      http.expectNone(listUrl);

      await vi.advanceTimersByTimeAsync(45_000);
      await flushResources();
      expect(feed.cancelled).toBe(true);
      http.expectOne(listUrl).flush({ content: [] });
      await flushResources();
      expect(store.rooms()).toEqual([]);
      http.verify();
    } finally {
      TestBed.resetTestingModule();
      vi.useRealTimers();
    }
  });

  it('resumes the live feed after falling back to polling', async () => {
    vi.useFakeTimers();
    try {
      const store = TestBed.inject(RoomsStore);
      const http = TestBed.inject(HttpTestingController);
      const interruptFeed = async () => {
        http.expectOne(feedUrl).flush('Unavailable', { status: 503, statusText: 'Unavailable' });
        await flushResources();
        http.expectOne(listUrl).flush({ content: [room] });
        await flushResources();
      };

      store.ensureLoaded();
      await flushResources();
      await interruptFeed();
      await vi.advanceTimersByTimeAsync(1500);
      await flushResources();
      await interruptFeed();
      await vi.advanceTimersByTimeAsync(3000);
      await flushResources();
      await interruptFeed();
      for (let tick = 0; tick < 4; tick++) {
        await vi.advanceTimersByTimeAsync(15_000);
        await flushResources();
        http.expectOne(listUrl).flush({ content: [room] });
        await flushResources();
      }
      const recoveredFeed = http.expectOne(feedUrl);
      const snapshot = `data: ${JSON.stringify({ type: 'SNAPSHOT', rooms: [] })}\n\n`;
      recoveredFeed.event({
        type: HttpEventType.DownloadProgress,
        loaded: snapshot.length,
        partialText: snapshot,
      });
      await flushResources();
      expect(store.hasLoaded()).toBe(true);
      expect(store.rooms()).toEqual([]);

      await vi.advanceTimersByTimeAsync(15_000);
      await flushResources();
      http.expectNone(listUrl);
      http.verify();
    } finally {
      TestBed.resetTestingModule();
      vi.useRealTimers();
    }
  });
});
