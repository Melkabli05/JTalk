import { parseStage } from './stage.parser';

describe('stage parser', () => {
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
});
