import { parseRoomFeedEvent } from './room-feed.parser';

const room = {
  id: 'r-1',
  title: 'Spanish',
  topic: null,
  hostId: 'h-1',
  targetLanguage: 'es',
  nativeLanguage: 'en',
  maxStageSeats: 6,
  speakers: ['h-1'],
  participantCount: 2,
  handRaiseCount: 0,
};

describe('room feed parser', () => {
  it('reads READY', () => {
    expect(parseRoomFeedEvent({ type: 'READY' })).toEqual({ type: 'READY' });
  });

  it('reads a room that opened or changed', () => {
    expect(parseRoomFeedEvent({ type: 'ROOM_OPENED', roomId: 'r-1', room })).toMatchObject({
      type: 'ROOM_OPENED',
      room: { id: 'r-1', topic: '' },
    });
    expect(parseRoomFeedEvent({ type: 'ROOM_UPDATED', roomId: 'r-1', room })).toMatchObject({
      type: 'ROOM_UPDATED',
    });
  });

  it('reads a room that closed', () => {
    expect(parseRoomFeedEvent({ type: 'ROOM_CLOSED', roomId: 'r-1' })).toEqual({
      type: 'ROOM_CLOSED',
      roomId: 'r-1',
    });
  });

  it('reads the numbers of a room', () => {
    expect(
      parseRoomFeedEvent({
        type: 'ROOM_STATS',
        roomId: 'r-1',
        live: { speakers: [], participantCount: 3, handRaiseCount: 1 },
      }),
    ).toEqual({
      type: 'ROOM_STATS',
      roomId: 'r-1',
      speakers: [],
      participantCount: 3,
      handRaiseCount: 1,
    });
  });

  it('skips messages of a kind it does not know, and ones of the wrong shape', () => {
    expect(parseRoomFeedEvent({ type: 'SOMETHING_NEW' })).toBeUndefined();
    expect(
      parseRoomFeedEvent({ type: 'ROOM_OPENED', room: { ...room, hostId: 5 } }),
    ).toBeUndefined();
    expect(parseRoomFeedEvent({ type: 'ROOM_CLOSED' })).toBeUndefined();
    expect(parseRoomFeedEvent({ type: 'ROOM_STATS', roomId: 'r-1', live: {} })).toBeUndefined();
    expect(parseRoomFeedEvent('text')).toBeUndefined();
    expect(parseRoomFeedEvent(null)).toBeUndefined();
  });
});
