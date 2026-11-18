import { REACTIONS } from '../models/reaction.model';
import { REACTION_LOOKS } from './reactions';

describe('REACTION_LOOKS', () => {
  it('has art and a label for every reaction, and each one has its own art', () => {
    const images = REACTIONS.map((reaction) => REACTION_LOOKS[reaction].image);

    for (const reaction of REACTIONS) {
      expect(REACTION_LOOKS[reaction].label).not.toBe('');
    }
    expect(new Set(images).size).toBe(REACTIONS.length);
  });
});
