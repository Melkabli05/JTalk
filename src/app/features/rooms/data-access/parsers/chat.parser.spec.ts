import { parseChatEvent, parseChatState, parseComment } from './chat.parser';

const comment = {
  id: 'c-1',
  authorId: 'u-1',
  type: 'TEXT',
  content: 'Hola',
  createdAt: '2026-11-19T10:00:00Z',
};

describe('chat parser', () => {
  it('reads a comment, keeping only what is there', () => {
    expect(parseComment(comment)).toEqual({
      id: 'c-1',
      authorId: 'u-1',
      type: 'TEXT',
      content: 'Hola',
      createdAt: '2026-11-19T10:00:00Z',
    });
    expect(
      parseComment({ ...comment, type: 'CORRECTION', correctedContent: 'Hola!', replyTo: 'c-0' }),
    ).toMatchObject({ type: 'CORRECTION', correctedContent: 'Hola!', replyTo: 'c-0' });
  });

  it.each([
    ['no author', { ...comment, authorId: undefined }],
    ['a type it does not know', { ...comment, type: 'SYSTEM' }],
    ['text that is not a string', { ...comment, content: 5 }],
    ['nothing', null],
  ])('refuses a comment with %s', (_name, raw) => {
    expect(() => parseComment(raw)).toThrow('expected a comment');
  });

  it('reads the chat as someone in the room opens it', () => {
    expect(
      parseChatState({ comments: [comment], topic: 'Weekend', muted: false, mutedUsers: ['u-2'] }),
    ).toEqual({
      comments: [parseComment(comment)],
      topic: 'Weekend',
      muted: false,
      mutedUsers: ['u-2'],
    });
    expect(parseChatState({ comments: [], muted: true, mutedUsers: [] }).topic).toBeNull();
  });

  it.each([
    ['comments that are not a list', { comments: {}, muted: false, mutedUsers: [] }],
    ['a muted flag that is not a boolean', { comments: [], muted: 'no', mutedUsers: [] }],
    ['a comment that is wrong', { comments: [{}], muted: false, mutedUsers: [] }],
    ['a topic that is not text', { comments: [], topic: 4, muted: false, mutedUsers: [] }],
  ])('refuses a chat with %s', (_name, raw) => {
    expect(() => parseChatState(raw)).toThrow();
  });

  it('reads each change to the chat', () => {
    expect(parseChatEvent({ type: 'COMMENT_POSTED', comment })).toMatchObject({
      type: 'COMMENT_POSTED',
      comment: { id: 'c-1' },
    });
    expect(parseChatEvent({ type: 'COMMENT_DELETED', commentId: 'c-1' })).toEqual({
      type: 'COMMENT_DELETED',
      commentId: 'c-1',
    });
    expect(parseChatEvent({ type: 'CHAT_MUTED', targetUserId: 'u-2' })).toEqual({
      type: 'CHAT_MUTED',
      userId: 'u-2',
    });
    expect(parseChatEvent({ type: 'CHAT_UNMUTED', targetUserId: 'u-2' })).toEqual({
      type: 'CHAT_UNMUTED',
      userId: 'u-2',
    });
    expect(parseChatEvent({ type: 'TOPIC_CHANGED', topic: 'Weekend' })).toEqual({
      type: 'TOPIC_CHANGED',
      topic: 'Weekend',
    });
  });

  it('reads a topic that went away as none', () => {
    expect(parseChatEvent({ type: 'TOPIC_CHANGED' })).toEqual({
      type: 'TOPIC_CHANGED',
      topic: null,
    });
  });

  it('skips what it does not know or cannot use', () => {
    expect(parseChatEvent({ type: 'SOMETHING_NEW' })).toBeUndefined();
    expect(parseChatEvent({ type: 'COMMENT_POSTED', comment: {} })).toBeUndefined();
    expect(parseChatEvent({ type: 'COMMENT_DELETED' })).toBeUndefined();
    expect(parseChatEvent({ type: 'CHAT_MUTED' })).toBeUndefined();
    expect(parseChatEvent({ type: 'TOPIC_CHANGED', topic: 3 })).toBeUndefined();
    expect(parseChatEvent('text')).toBeUndefined();
  });
});
