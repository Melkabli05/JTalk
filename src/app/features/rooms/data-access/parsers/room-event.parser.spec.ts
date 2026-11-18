import { parseRoomEvent } from './room-event.parser';

describe('parseRoomEvent', () => {
  const at = '2026-11-17T10:00:00.250Z';

  it('reads a stage change with the stage it carries', () => {
    expect(
      parseRoomEvent({
        type: 'STAGE_UPDATED',
        roomId: 'r-1',
        timestamp: at,
        stage: { speakers: ['h-1'], handRaiseQueue: [] },
      }),
    ).toEqual({
      type: 'STAGE_UPDATED',
      at: Date.parse(at),
      stage: { speakers: ['h-1'], handRaiseQueue: [] },
    });
  });

  it('reads who a reconnecting speaker is', () => {
    expect(parseRoomEvent({ type: 'SPEAKER_RECONNECTING', targetUserId: 'b-1' })).toEqual({
      type: 'SPEAKER_RECONNECTING',
      userId: 'b-1',
    });
  });

  it('reads who came and went, and how many are present', () => {
    expect(
      parseRoomEvent({
        type: 'PRESENCE_CHANGED',
        presence: { participantCount: 4, joined: ['a'], left: [] },
      }),
    ).toEqual({ type: 'PRESENCE_CHANGED', participantCount: 4, joined: ['a'], left: [] });
  });

  it('reads who reacted with what, and drops reactions it does not know', () => {
    expect(
      parseRoomEvent({
        type: 'REACTIONS',
        reactions: [
          { userId: 'b-1', reaction: 'HEART' },
          { userId: 'm-1', reaction: 'FIREWORKS' },
          { reaction: 'SMILE' },
          { userId: 'm-1', reaction: 'SPARKLES' },
          { userId: 'b-1', reaction: 'CLAP' },
          { userId: 'b-1', reaction: 'THANKS' },
        ],
      }),
    ).toEqual({
      type: 'REACTIONS',
      reactions: [
        { userId: 'b-1', reaction: 'HEART' },
        { userId: 'm-1', reaction: 'SPARKLES' },
        { userId: 'b-1', reaction: 'CLAP' },
        { userId: 'b-1', reaction: 'THANKS' },
      ],
    });
  });

  it.each([
    ['not an object', 'nope'],
    ['reactions without any reaction', { type: 'REACTIONS', reactions: [] }],
    ['reactions that are not a list', { type: 'REACTIONS', reactions: 'HEART' }],
    ['an unknown type', { type: 'SOMETHING_NEW' }],
    ['a stage change without a stage', { type: 'HAND_RAISED', timestamp: at }],
    [
      'a stage change without a time',
      { type: 'HAND_RAISED', stage: { speakers: [], handRaiseQueue: [] } },
    ],
    ['a reconnect without a user', { type: 'SPEAKER_RECONNECTED' }],
    [
      'a presence change with a bad count',
      { type: 'PRESENCE_CHANGED', presence: { participantCount: 'x', joined: [], left: [] } },
    ],
  ])('rejects %s', (_name, raw) => {
    expect(parseRoomEvent(raw)).toBeUndefined();
  });
});
