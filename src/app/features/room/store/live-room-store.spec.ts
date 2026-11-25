import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { provideNoopAuthForTests } from '../../../core/auth/auth.providers';
import { IdentityStore } from '../../../core/auth/identity';
import { LIVEKIT_CONNECTOR, LiveKitListener } from '../data-access/livekit-audio-engine';
import { LiveRoomStore } from './live-room-store';

describe('room session', () => {
  const room = {
    id: 'room',
    hostId: 'host',
    title: 'Practice',
    topic: '',
    targetLanguage: 'ar',
    nativeLanguage: 'en',
    maxStageSeats: 12,
    speakers: ['host'],
    participantCount: 2,
    handRaiseCount: 0,
  };
  const base = '/api/v1/voice-rooms/room';
  const chat = { comments: [], topic: null, muted: false, mutedUsers: [], reactions: [] };
  const makeSnapshot = (speakers: string[] = ['host'], audienceIds: string[] = ['guest']) => ({
    speakers: speakers.map((userId) => ({ userId, displayName: userId, isReconnecting: false })),
    audienceCount: audienceIds.length,
    audience: {
      audiencePreview: audienceIds.map((userId) => ({ userId, displayName: userId })),
      nextCursor: null,
      hasMoreAudience: false,
    },
    handRaiseQueue: [],
    chat,
  });
  const session = {
    room,
    liveKitUrl: 'wss://example.invalid',
    liveKitToken: 'join-token',
    canPublishAudio: true,
    role: 'HOST',
    isChatMuted: false,
    snapshot: makeSnapshot(),
  };

  const flushResources = async (): Promise<void> => {
    TestBed.tick();
    await Promise.resolve();
    TestBed.tick();
  };

  it('joins with the server snapshot, moderates, posts a correction, resynchronizes via single snapshot endpoint, and leaves', async () => {
    let listener!: LiveKitListener;
    const disconnect = vi.fn(async () => undefined);
    const microphone = vi.fn(async () => undefined);
    const connector = vi.fn(async (_url, _token, _opts, events: LiveKitListener) => {
      listener = events;
      return { disconnect, setMicrophone: microphone, listAudioInputDevices: async () => [] };
    });
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNoopAuthForTests(),
        { provide: LIVEKIT_CONNECTOR, useValue: connector },
      ],
    });
    TestBed.inject(IdentityStore).me.set({
      id: 'host',
      username: 'host',
      displayName: 'Host',
      bio: null,
      avatarUrl: null,
      countryCode: null,
      nativeLanguage: 'en',
      nativeLanguages: ['en'],
      learningLanguages: [],
      createdAt: '2026-01-01T00:00:00Z',
    });
    const store = TestBed.inject(LiveRoomStore);
    const http = TestBed.inject(HttpTestingController);

    const entering = store.enterRoom(room.id);
    await vi.waitFor(() => http.expectOne(base + '/participants/join').flush(session));
    expect(await entering).toBe(true);
    expect(connector.mock.calls[0].slice(0, 2)).toEqual(['wss://example.invalid', 'join-token']);
    expect(microphone).toHaveBeenCalledWith(true);
    expect(store.stage.audienceIds()).toEqual(['guest']);
    expect(store.stage.isHost()).toBe(true);
    expect(await store.toggleSelfMic()).toEqual({ ok: true });
    expect(microphone).toHaveBeenCalledWith(false);

    const tracks = { primarySids: ['track-1'], secondarySids: ['track-2'] };
    const networkModeUrl = base + '/stage/network-mode';
    listener.onConnectionQuality('poor', tracks);
    const reduceBandwidth = http.expectOne(networkModeUrl);
    expect(reduceBandwidth.request.body.mode).toBe('LOW_BANDWIDTH');

    listener.onConnectionQuality('excellent', { primarySids: [], secondarySids: [] });
    http.expectNone(networkModeUrl);
    reduceBandwidth.flush(null);
    const restoreBandwidth = await vi.waitFor(() => http.expectOne(networkModeUrl));
    expect(restoreBandwidth.request.body.mode).toBe('OPTIMAL');
    restoreBandwidth.flush(null);

    const promoting = store.stage.promoteToStage('guest');
    http.expectOne({ method: 'POST', url: base + '/stage/promote/guest' }).flush(null);
    expect((await promoting).ok).toBe(true);

    listener.onLinkStatus('reconnecting');
    listener.onLinkStatus('connected');
    await flushResources();
    const snapshotReq = http.expectOne(base + '/participants/snapshot');
    listener.onRoomEvent({ type: 'ROOM_UPDATED', title: 'Live title', topic: '', maxStageSeats: 8 });
    listener.onRoomEvent({
      type: 'STAGE_UPDATED',
      stage: { speakers: ['host', 'guest'], handRaiseQueue: [] },
      at: 1,
    });
    snapshotReq.flush(null, { status: 503, statusText: 'Unavailable' });
    await flushResources();
    expect(store.messagesLoading()).toBe(false);
    expect(store.stage.stage().speakers).toEqual(['host', 'guest']);
    expect(store.room()?.title).toBe('Live title');
    expect(store.chat.chatError()).toBe(true);

    let reloaded: boolean | undefined;
    store.chat.reloadMessages((ok) => {
      reloaded = ok;
    });
    await flushResources();
    const staleChat = http.expectOne(base + '/comments');
    const incoming = {
      id: 'message',
      type: 'TEXT' as const,
      authorId: 'guest',
      content: 'Welcome',
      createdAt: '2026-01-01T00:00:00Z',
    };
    listener.onChatEvent({ type: 'COMMENT_POSTED', comment: incoming });
    staleChat.flush(chat);
    await flushResources();
    http.expectOne(base + '/comments').flush({
      ...chat,
      comments: [{ ...incoming, pinnedAt: incoming.createdAt }],
      reactions: [{ commentId: incoming.id, counts: { HEART: 2 }, mine: 'HEART' }],
    });
    await flushResources();
    expect(reloaded).toBe(true);
    expect(store.chat.messages().map((message) => message.text)).toEqual(['Welcome']);
    expect(store.chat.chatError()).toBe(false);
    expect(store.chat.pinnedCommentId()).toBe(incoming.id);
    expect(store.chat.commentReactions().get(incoming.id)).toEqual({
      counts: { HEART: 2 },
      mine: 'HEART',
    });

    listener.onChatEvent({ type: 'COMMENT_DELETED', commentId: incoming.id });
    expect(store.chat.messages()).toEqual([]);
    expect(store.chat.pinnedCommentId()).toBeNull();
    expect(store.chat.commentReactions().has(incoming.id)).toBe(false);

    store.chat.setReplyTarget('Guest', 'parent', 'I goes');
    const sending = store.chat.sendMessage('I go');
    const post = http.expectOne({ method: 'POST', url: base + '/comments' });
    expect(post.request.body).toEqual({
      type: 'CORRECTION',
      content: 'I goes',
      correctedContent: 'I go',
      replyTo: 'parent',
    });
    store.chat.setReplyTarget('New reply', 'other');
    post.flush({
      ...post.request.body,
      id: 'reply',
      authorId: 'host',
      createdAt: '2026-01-01T00:00:00Z',
    });
    expect((await sending).ok).toBe(true);
    expect(store.chat.messages().find((message) => message.id === 'reply')?.text).toBe('I goes → I go');
    expect(store.chat.replyTarget()).toBe('New reply');

    const leaving = store.leaveRoom();
    await vi.waitFor(() =>
      http.expectOne({ method: 'POST', url: base + '/participants/leave' }).flush(null),
    );
    expect((await leaving).ok).toBe(true);
    expect(disconnect).toHaveBeenCalledOnce();
    expect(store.room()).toBeNull();
    http.verify();
  });

  it('reconciles room commands with chat, reaction, and presence events', async () => {
    let listener!: LiveKitListener;
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNoopAuthForTests(),
        {
          provide: LIVEKIT_CONNECTOR,
          useValue: async (
            _url: string,
            _token: string,
            _options: unknown,
            events: LiveKitListener,
          ) => {
            listener = events;
            return { disconnect: async () => undefined, listAudioInputDevices: async () => [] };
          },
        },
      ],
    });
    const store = TestBed.inject(LiveRoomStore);
    const http = TestBed.inject(HttpTestingController);
    const entering = store.enterRoom(room.id);
    await vi.waitFor(() => http.expectOne(base + '/participants/join').flush(session));
    expect(await entering).toBe(true);

    const pinning = store.chat.setChatTopic('Practice\n\n\ntoday');
    listener.onChatEvent({ type: 'TOPIC_CHANGED', topic: 'Practice\n\n\ntoday' });
    http.expectOne({ method: 'PUT', url: base + '/comments/topic' }).flush(null);
    await flushResources();
    expect((await pinning).ok).toBe(true);
    expect(store.chat.pinnedTopic()).toBe('Practice\n\n\ntoday');
    http.expectNone(base + '/comments');

    const clearing = store.chat.setChatTopic('');
    http.expectOne({ method: 'DELETE', url: base + '/comments/topic' }).flush(null);
    expect((await clearing).ok).toBe(true);
    await flushResources();
    http.expectNone(base + '/comments');
    expect(store.chat.pinnedTopic()).toBeNull();

    const reacting = store.stage.triggerStageReaction('CLAP');
    const request = http.expectOne({ method: 'POST', url: base + '/reactions' });
    expect(request.request.body).toEqual({ reaction: 'CLAP' });
    listener.onRoomEvent({ type: 'REACTIONS', reactions: [{ userId: 'host', reaction: 'CLAP' }] });
    request.flush(null);
    expect((await reacting).ok).toBe(true);
    expect(store.stage.stageReaction()).toBe('👏');
    expect(store.stage.stageReactionKey()).toBe(1);

    listener.onLinkStatus('reconnecting');
    listener.onLinkStatus('connected');
    await flushResources();
    const snapshot = http.expectOne(base + '/participants/snapshot');
    listener.onRoomEvent({
      type: 'PRESENCE_CHANGED',
      joined: ['new-listener'],
      left: [],
      participantCount: 3,
      audienceCount: 2,
    });
    snapshot.flush({ room, role: 'HOST', snapshot: makeSnapshot() });
    await flushResources();
    expect(store.messagesLoading()).toBe(false);
    expect(store.stage.audienceIds()).toEqual(['guest', 'new-listener']);
    expect(store.stage.audienceCount()).toBe(2);
    http.verify();
  });

  it('keeps the new room active when a stage claim from the previous room completes late', async () => {
    const connector = vi.fn(async () => ({
      disconnect: async () => undefined,
      listAudioInputDevices: async () => [],
    }));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNoopAuthForTests(),
        { provide: LIVEKIT_CONNECTOR, useValue: connector },
      ],
    });
    const store = TestBed.inject(LiveRoomStore);
    const http = TestBed.inject(HttpTestingController);

    const join = async (id: string) => {
      const path = `/api/v1/voice-rooms/${id}`;
      const dto = { ...room, id };
      const entering = store.enterRoom(id);
      if (id !== room.id) {
        await vi.waitFor(() => http.expectOne(base + '/participants/leave').flush(null));
      }
      await vi.waitFor(() =>
        http.expectOne(path + '/participants/join').flush({
          ...session,
          room: dto,
          role: 'LISTENER',
          canPublishAudio: false,
          liveKitToken: id,
          snapshot: makeSnapshot(['host'], ['guest']),
        }),
      );
      expect(await entering).toBe(true);
      expect(store.stage.audienceIds()).toEqual(['guest']);
      expect(store.stage.isHost()).toBe(false);
    };

    await join(room.id);
    const claiming = store.stage.claimStageSeat();
    const pendingClaim = http.expectOne(base + '/stage/join');
    await join('next');
    pendingClaim.flush(session);

    expect((await claiming).ok).toBe(false);
    expect(store.roomId()).toBe('next');
    expect(connector).toHaveBeenCalledTimes(2);
    http.verify();
  });

  it('skips redundant profile batch resolution for comment authors already present in the room snapshot', async () => {
    let listener!: LiveKitListener;
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNoopAuthForTests(),
        {
          provide: LIVEKIT_CONNECTOR,
          useValue: async (
            _url: string,
            _token: string,
            _options: unknown,
            events: LiveKitListener,
          ) => {
            listener = events;
            return { disconnect: async () => undefined, listAudioInputDevices: async () => [] };
          },
        },
      ],
    });
    const identity = TestBed.inject(IdentityStore);
    const resolveUsers = vi.spyOn(identity, 'resolveUsers').mockResolvedValue();
    const store = TestBed.inject(LiveRoomStore);
    const http = TestBed.inject(HttpTestingController);

    const entering = store.enterRoom(room.id);
    await vi.waitFor(() =>
      http.expectOne(base + '/participants/join').flush({
        ...session,
        snapshot: {
          ...makeSnapshot(),
          chat: {
            ...chat,
            comments: [
              { id: 'c0', type: 'TEXT', authorId: 'host', content: 'Host', createdAt: '2026-01-01T00:00:00Z' },
              { id: 'c-prev', type: 'TEXT', authorId: 'departed', content: 'Earlier', createdAt: '2026-01-01T00:00:05Z' },
            ],
          },
        },
      }),
    );
    expect(await entering).toBe(true);
    expect(resolveUsers).toHaveBeenCalledWith(['departed']);
    resolveUsers.mockClear();

    listener.onRoomEvent({
      type: 'PRESENCE_CHANGED',
      joined: ['new-listener'],
      left: [],
      participantCount: 3,
      audienceCount: 2,
    });
    expect(resolveUsers).toHaveBeenCalledWith(['new-listener']);
    resolveUsers.mockClear();

    listener.onChatEvent({
      type: 'COMMENT_POSTED',
      comment: {
        id: 'c1',
        type: 'TEXT',
        authorId: 'guest',
        content: 'Already in snapshot',
        createdAt: '2026-01-01T00:00:00Z',
      },
    });
    expect(resolveUsers).not.toHaveBeenCalled();

    listener.onChatEvent({
      type: 'COMMENT_POSTED',
      comment: {
        id: 'c2',
        type: 'TEXT',
        authorId: 'outsider',
        content: 'Needs profile lookup',
        createdAt: '2026-01-01T00:01:00Z',
      },
    });
    expect(resolveUsers).toHaveBeenCalledWith(['outsider']);

    resolveUsers.mockClear();
    store.chat.reloadMessages();
    await flushResources();
    http.expectOne(base + '/comments').flush({
      ...chat,
      comments: [
        { id: 'c1', type: 'TEXT', authorId: 'host', content: 'Host', createdAt: '2026-01-01T00:00:00Z' },
        { id: 'c2', type: 'TEXT', authorId: 'guest', content: 'Guest', createdAt: '2026-01-01T00:00:30Z' },
        { id: 'c3', type: 'TEXT', authorId: 'former-speaker', content: 'Left', createdAt: '2026-01-01T00:01:00Z' },
      ],
    });
    await flushResources();
    expect(resolveUsers).toHaveBeenCalledWith(['former-speaker']);
    http.verify();
  });
});
