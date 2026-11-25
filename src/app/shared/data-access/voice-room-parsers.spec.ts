import {
  parseChatRealtimeEvent,
  parseRoomRealtimeEvent,
} from './voice-room-parsers';

describe('LiveKit DataChannel parsers', () => {
  it('parses LiveKit room-events and room-chat server payloads', () => {
    const stageEvt = parseRoomRealtimeEvent({
      type: 'STAGE_UPDATED',
      timestamp: '2026-11-23T12:00:00Z',
      stage: { speakers: ['u-1'], handRaiseQueue: ['u-2'] },
    });
    expect(stageEvt?.type).toBe('STAGE_UPDATED');

    const reactEvt = parseRoomRealtimeEvent({
      type: 'REACTIONS',
      reactions: [{ userId: 'u-1', reaction: 'FIRE' }],
    });
    expect(reactEvt).toEqual({
      type: 'REACTIONS',
      reactions: [{ userId: 'u-1', reaction: 'FIRE' }],
    });

    const chatEvt = parseChatRealtimeEvent({
      type: 'COMMENT_REACTED',
      commentId: 'c-1',
      targetUserId: 'u-2',
      reaction: 'CLAP',
      previous: null,
    });
    expect(chatEvt).toEqual({
      type: 'COMMENT_REACTED',
      commentId: 'c-1',
      userId: 'u-2',
      reaction: 'CLAP',
      previous: null,
    });

    expect(parseChatRealtimeEvent({ type: 'COMMENT_PINNED', commentId: 'c-1' })).toEqual({
      type: 'COMMENT_PINNED',
      commentId: 'c-1',
    });
    expect(parseRoomRealtimeEvent({ type: 'COMMENT_PINNED', commentId: 'c-1' })).toBeUndefined();
  });
});
