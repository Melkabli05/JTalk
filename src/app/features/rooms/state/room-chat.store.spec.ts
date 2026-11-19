import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { fakeIdentity } from '@core/auth/auth-testing';
import type { RoomComment } from '../models/chat.model';
import { RoomChatStore } from './room-chat.store';
import { RoomStore } from './room.store';

const CHAT = '/api/v1/voice-rooms/r-1/comments';

const comment = (id: string, authorId = 'b-1', content = id): RoomComment => ({
  id,
  authorId,
  type: 'TEXT',
  content,
  createdAt: '2026-11-19T10:00:00Z',
});

const state = (comments: RoomComment[] = [], extra: object = {}) => ({
  comments,
  topic: null,
  muted: false,
  mutedUsers: [],
  ...extra,
});

describe('RoomChatStore', () => {
  let http: HttpTestingController;
  let room: RoomStore;
  let chat: RoomChatStore;
  const settle = async () => {
    await Promise.resolve();
    await Promise.resolve();
    TestBed.tick();
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        fakeIdentity({ id: 'm-1', name: 'Me', nativeLanguage: 'ar', learning: 'es', avatar: '' })
          .provider,
      ],
    });
    http = TestBed.inject(HttpTestingController);
    room = TestBed.inject(RoomStore);
    chat = TestBed.inject(RoomChatStore);
  });

  async function opened(body: object = state()) {
    room.show('r-1');
    room.sync();
    TestBed.tick();
    http.expectOne(CHAT).flush(body);
    await settle();
  }

  it('reads the chat only once the room is being read', async () => {
    room.show('r-1');
    TestBed.tick();
    http.expectNone(CHAT);
    expect(chat.ready()).toBe(false);

    room.sync();
    TestBed.tick();
    http
      .expectOne(CHAT)
      .flush(state([comment('c-1')], { topic: 'Weekend', muted: true, mutedUsers: ['b-2'] }));
    await settle();

    expect(chat.ready()).toBe(true);
    expect(chat.comments().map((c) => c.id)).toEqual(['c-1']);
    expect(chat.topic()).toBe('Weekend');
    expect(chat.muted()).toBe(true);
    expect(chat.mutedUsers()).toEqual(['b-2']);
  });

  it('says it failed when the chat cannot be read, and reads it again on reload', async () => {
    room.show('r-1');
    room.sync();
    TestBed.tick();
    http.expectOne(CHAT).flush('no', { status: 500, statusText: 'Error' });
    await settle();
    expect(chat.failed()).toBe(true);

    chat.reload();
    TestBed.tick();
    http.expectOne(CHAT).flush(state([comment('c-1')]));
    await settle();

    expect(chat.failed()).toBe(false);
    expect(chat.comments()).toHaveLength(1);
  });

  it('adds a comment once, however many times it is told, and drops one that is deleted', async () => {
    await opened();

    chat.apply({ type: 'COMMENT_POSTED', comment: comment('c-1') });
    chat.apply({ type: 'COMMENT_POSTED', comment: comment('c-1') });
    chat.posted(comment('c-1'));
    chat.apply({ type: 'COMMENT_POSTED', comment: comment('c-2') });
    expect(chat.comments().map((c) => c.id)).toEqual(['c-1', 'c-2']);

    chat.apply({ type: 'COMMENT_DELETED', commentId: 'c-1' });
    expect(chat.comments().map((c) => c.id)).toEqual(['c-2']);
  });

  it('keeps only the last fifty', async () => {
    await opened();

    for (let i = 1; i <= 55; i++) {
      chat.apply({ type: 'COMMENT_POSTED', comment: comment(`c-${i}`) });
    }

    expect(chat.comments()).toHaveLength(50);
    expect(chat.comments()[0].id).toBe('c-6');
    expect(chat.comments()[49].id).toBe('c-55');
  });

  it('counts what other people say while the chat is closed, and clears the count when it is opened', async () => {
    await opened();

    chat.apply({ type: 'COMMENT_POSTED', comment: comment('c-1') });
    chat.apply({ type: 'COMMENT_POSTED', comment: comment('c-2', 'm-1') });
    chat.apply({ type: 'COMMENT_POSTED', comment: comment('c-3') });
    expect(chat.unread()).toBe(2);

    chat.watch(true);
    expect(chat.unread()).toBe(0);
    chat.apply({ type: 'COMMENT_POSTED', comment: comment('c-4') });
    expect(chat.unread()).toBe(0);

    chat.watch(false);
    chat.apply({ type: 'COMMENT_POSTED', comment: comment('c-5') });
    expect(chat.unread()).toBe(1);
  });

  it('knows who is muted, and when it is the person themselves', async () => {
    await opened();

    chat.apply({ type: 'CHAT_MUTED', userId: 'b-2' });
    chat.apply({ type: 'CHAT_MUTED', userId: 'b-2' });
    expect(chat.mutedUsers()).toEqual(['b-2']);
    expect(chat.muted()).toBe(false);

    chat.apply({ type: 'CHAT_MUTED', userId: 'm-1' });
    expect(chat.muted()).toBe(true);

    chat.apply({ type: 'CHAT_UNMUTED', userId: 'm-1' });
    chat.apply({ type: 'CHAT_UNMUTED', userId: 'b-2' });
    expect(chat.muted()).toBe(false);
    expect(chat.mutedUsers()).toEqual([]);
  });

  it('follows the pinned topic, and its going away', async () => {
    await opened();

    chat.apply({ type: 'TOPIC_CHANGED', topic: 'Weekend' });
    expect(chat.topic()).toBe('Weekend');

    chat.apply({ type: 'TOPIC_CHANGED', topic: null });
    expect(chat.topic()).toBeNull();
  });

  it('applies again, after a read, what arrived while it was in flight, since the read may be older', async () => {
    room.show('r-1');
    room.sync();
    TestBed.tick();
    const read = http.expectOne(CHAT);

    chat.apply({ type: 'COMMENT_POSTED', comment: comment('c-2') });
    chat.apply({ type: 'TOPIC_CHANGED', topic: 'Newer' });
    read.flush(state([comment('c-1')], { topic: 'Older' }));
    await settle();

    expect(chat.comments().map((c) => c.id)).toEqual(['c-1', 'c-2']);
    expect(chat.topic()).toBe('Newer');
  });

  it('starts clean for another room', async () => {
    await opened(state([comment('c-1')]));
    chat.apply({ type: 'COMMENT_POSTED', comment: comment('c-2') });
    expect(chat.unread()).toBe(1);

    room.show('r-2');
    await settle();

    expect(chat.unread()).toBe(0);
    expect(chat.comments()).toEqual([]);
    expect(chat.ready()).toBe(false);
  });
});
