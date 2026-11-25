import { decodeRoomFeedMessage } from './room-feed';

describe('room feed messages', () => {
  it('preserves the backend statistics envelope', () => {
    const stats = {
      type: 'ROOM_STATS', roomId: 'room',
      live: { speakers: ['speaker'], participantCount: 2, handRaiseCount: 0 },
    };
    expect(decodeRoomFeedMessage(JSON.stringify(stats))).toEqual(stats);
    expect(decodeRoomFeedMessage(JSON.stringify({ ...stats, live: null }))).toBeUndefined();
  });

  it('accepts room closures and empty snapshots', () => {
    for (const event of [{ type: 'ROOM_CLOSED', roomId: 'room' }, { type: 'SNAPSHOT', rooms: [] }]) {
      expect(decodeRoomFeedMessage(JSON.stringify(event))).toEqual(event);
    }
  });
});
