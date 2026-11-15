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
        { userId: 'a', status: 'ACTIVE' },
        { userId: 'b', status: 'RECONNECTING' },
      ]),
    ).toEqual([
      { userId: 'a', reconnecting: false },
      { userId: 'b', reconnecting: true },
    ]);
  });

  it.each([{}, [{ userId: 'a', status: 'GONE' }], [{ status: 'ACTIVE' }]])(
    'refuses %j as participants',
    (raw) => {
      expect(() => parseParticipants(raw)).toThrow('Unexpected response');
    },
  );
});
