export function computeSpeakerGridColumns(totalSlots: number): 2 | 3 | 4 {
  if (totalSlots <= 2) {
    return 2;
  }
  if (totalSlots === 3) {
    return 3;
  }
  return 4;
}
