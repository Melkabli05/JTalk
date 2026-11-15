import { parseRoom, parseRooms, parseSession } from './room.parser';

const dto = {
  id: 'r-1',
  title: 'Spanish for beginners',
  topic: null,
  hostId: 'h-1',
  targetLanguage: 'es',
  nativeLanguage: 'en',
  maxStageSeats: 6,
  speakers: ['h-1', 's-2'],
  participantCount: 5,
  handRaiseCount: 1,
};

describe('room parser', () => {
  it('maps a room, with no topic as an empty one', () => {
    const room = parseRoom(dto);

    expect(room.topic).toBe('');
    expect(room.speakers).toEqual(['h-1', 's-2']);
  });

  it('reads a page of rooms', () => {
    expect(parseRooms({ content: [dto, { ...dto, id: 'r-2' }] }).map((room) => room.id)).toEqual([
      'r-1',
      'r-2',
    ]);
  });

  it.each([
    ['a page without content', {}],
    ['a list instead of a page', [dto]],
    ['a room without a title', { content: [{ ...dto, title: undefined }] }],
    ['a room whose speakers are not ids', { content: [{ ...dto, speakers: [1] }] }],
  ])('refuses %s', (_name, raw) => {
    expect(() => parseRooms(raw)).toThrow('Unexpected response');
  });

  it('refuses something that is not a room', () => {
    expect(() => parseRoom(null)).toThrow('expected a room');
  });

  it('reads a session: the room and what the person is in it', () => {
    const session = parseSession({
      room: dto,
      role: 'HOST',
      canPublishAudio: true,
      liveKitToken: 'x',
      liveKitUrl: 'wss://livekit.test',
    });

    expect(session.room.id).toBe('r-1');
    expect(session).toMatchObject({
      canPublishAudio: true,
      liveKitUrl: 'wss://livekit.test',
      liveKitToken: 'x',
    });
    expect(() => parseSession({ room: dto, role: 'KING' })).toThrow('expected a room session');
  });

  it('refuses a session that does not say where and how to connect to the audio', () => {
    const complete = {
      room: dto,
      role: 'HOST',
      canPublishAudio: true,
      liveKitToken: 'x',
      liveKitUrl: 'wss://x',
    };

    for (const missing of ['canPublishAudio', 'liveKitToken', 'liveKitUrl']) {
      const incomplete = Object.fromEntries(
        Object.entries(complete).filter(([key]) => key !== missing),
      );
      expect(() => parseSession(incomplete), missing).toThrow('expected a room session');
    }
  });
});
