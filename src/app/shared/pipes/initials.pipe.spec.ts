import { InitialsPipe } from './initials.pipe';

describe('InitialsPipe', () => {
  const pipe = new InitialsPipe();

  it.each([
    ['Ada Lovelace', 'AL'],
    ['  grace   brewster   hopper ', 'GH'],
    ['Madonna', 'M'],
    ['', ''],
    ['   ', ''],
    [null, ''],
    [undefined, ''],
  ])('turns %j into %j', (name, expected) => {
    expect(pipe.transform(name)).toBe(expected);
  });
});
