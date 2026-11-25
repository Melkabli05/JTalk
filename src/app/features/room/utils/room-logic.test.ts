import { computeSpeakerGridColumns } from './room-logic';

describe('computeSpeakerGridColumns', () => {
  it('uses two, three or four columns as the stage grows', () => {
    expect([0, 1, 2, 3, 4, 12].map(computeSpeakerGridColumns)).toEqual([2, 2, 2, 3, 4, 4]);
  });
});
