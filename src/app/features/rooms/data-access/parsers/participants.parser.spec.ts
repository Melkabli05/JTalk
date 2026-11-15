import { parseParticipants } from './participants.parser';

describe('participants parser', () => {
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
