import { parseParticipants, parseStage } from './stage.adapter';

describe('stage adapter', () => {
  it('reads the speakers and the queue in order', () => {
    expect(parseStage({ speakers: ['a', 'b'], handRaiseQueue: ['c'] })).toEqual({
      speakers: ['a', 'b'],
      handRaiseQueue: ['c'],
    });
  });

  it.each([null, {}, { speakers: ['a'] }, { speakers: ['a'], handRaiseQueue: [3] }])(
    'refuses %j as a stage',
    (raw) => {
      expect(() => parseStage(raw)).toThrow('expected a stage');
    },
  );

  it('reads who is in the room, and who is reconnecting', () => {
    expect(
      parseParticipants([
        { userId: 'a', role: 'HOST', status: 'ACTIVE' },
        { userId: 'b', role: 'SPEAKER', status: 'RECONNECTING' },
      ]),
    ).toEqual([
      { userId: 'a', role: 'HOST', reconnecting: false },
      { userId: 'b', role: 'SPEAKER', reconnecting: true },
    ]);
  });

  it.each([
    {},
    [{ userId: 'a', role: 'KING', status: 'ACTIVE' }],
    [{ userId: 'a', role: 'HOST', status: 'GONE' }],
  ])('refuses %j as participants', (raw) => {
    expect(() => parseParticipants(raw)).toThrow('Unexpected response');
  });
});
