import type { VoiceRoomDto } from '../../models/room.dto';
import {
  parseRoom,
  parseRooms,
  parseSession,
  toCreatePayload,
  toRoom,
  toUpdatePayload,
} from './rooms.adapter';

const dto: VoiceRoomDto = {
  id: 'r-1',
  title: 'Spanish for beginners',
  topic: null,
  hostId: 'h-1',
  targetLanguage: 'es',
  nativeLanguage: 'en',
  maxStageSeats: 6,
  createdAt: '2026-11-14T10:00:00Z',
  speakers: ['h-1', 's-2'],
  participantCount: 5,
  handRaiseCount: 1,
};

describe('rooms adapter', () => {
  it('maps a room, with no topic as an empty one and the date as a Date', () => {
    const room = toRoom(dto);

    expect(room.topic).toBe('');
    expect(room.createdAt.toISOString()).toBe('2026-11-14T10:00:00.000Z');
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
    ['a room with an impossible date', { content: [{ ...dto, createdAt: 'yesterday' }] }],
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
    });

    expect(session.role).toBe('HOST');
    expect(session.room.id).toBe('r-1');
    expect(() => parseSession({ room: dto, role: 'KING' })).toThrow('expected a room session');
  });

  it('sends only what the API takes', () => {
    const draft = {
      title: 'T',
      topic: 'p',
      targetLanguage: 'es',
      nativeLanguage: 'en',
      maxStageSeats: 4,
    };

    expect(toCreatePayload({ ...draft, extra: 1 } as typeof draft)).toEqual(draft);
    expect(
      toUpdatePayload({ title: 'T', topic: 'p', maxStageSeats: 4, extra: 1 } as never),
    ).toEqual({
      title: 'T',
      topic: 'p',
      maxStageSeats: 4,
    });
  });
});
