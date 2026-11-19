import { withReaction } from './comment-reactions';

describe('withReaction', () => {
  it('starts a tally with the first reaction', () => {
    expect(withReaction(undefined, null, 'CLAP', false)).toEqual({
      counts: { CLAP: 1 },
      mine: null,
    });
  });

  it('adds to what others chose, and is the viewer’s own only when it is theirs', () => {
    const tally = { counts: { CLAP: 2 }, mine: null };

    expect(withReaction(tally, null, 'CLAP', true)).toEqual({ counts: { CLAP: 3 }, mine: 'CLAP' });
    expect(withReaction(tally, null, 'FIRE', false)).toEqual({
      counts: { CLAP: 2, FIRE: 1 },
      mine: null,
    });
  });

  it('moves a person from one reaction to another', () => {
    const tally = { counts: { CLAP: 2 }, mine: 'CLAP' } as const;

    expect(withReaction(tally, 'CLAP', 'HEART', true)).toEqual({
      counts: { CLAP: 1, HEART: 1 },
      mine: 'HEART',
    });
  });

  it('keeps the viewer’s own choice when someone else changes theirs', () => {
    const tally = { counts: { CLAP: 2 }, mine: 'CLAP' } as const;

    expect(withReaction(tally, 'CLAP', null, false)).toEqual({ counts: { CLAP: 1 }, mine: 'CLAP' });
  });

  it('is gone once nobody reacts, and never counts below none', () => {
    expect(withReaction({ counts: { CLAP: 1 }, mine: 'CLAP' }, 'CLAP', null, true)).toBeUndefined();
    expect(withReaction(undefined, 'CLAP', null, false)).toBeUndefined();
  });
});
