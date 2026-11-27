export interface CorrectionDiffPart {
  readonly text: string;
  readonly changed: boolean;
}

export interface CorrectionDiffResult {
  readonly originalParts: readonly CorrectionDiffPart[];
  readonly correctedParts: readonly CorrectionDiffPart[];
}

function mergeAdjacentParts(tokens: readonly CorrectionDiffPart[]): readonly CorrectionDiffPart[] {
  const merged: CorrectionDiffPart[] = [];
  for (const token of tokens) {
    const prev = merged.at(-1);
    if (prev && prev.changed === token.changed) {
      merged[merged.length - 1] = { text: `${prev.text} ${token.text}`, changed: prev.changed };
    } else {
      merged.push(token);
    }
  }
  return merged;
}

/**
 * Computes a word-level LCS diff between the original message and its corrected form,
 * grouping contiguous changed words into single highlight spans.
 */
export function computeCorrectionDiff(original: string, corrected: string): CorrectionDiffResult {
  const origWords = original.trim().split(/\s+/).filter(Boolean);
  const corrWords = corrected.trim().split(/\s+/).filter(Boolean);
  const m = origWords.length;
  const n = corrWords.length;

  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i]![j] =
        origWords[i] === corrWords[j]
          ? (dp[i + 1]?.[j + 1] ?? 0) + 1
          : Math.max(dp[i + 1]?.[j] ?? 0, dp[i]?.[j + 1] ?? 0);
    }
  }

  const origTokens: CorrectionDiffPart[] = [];
  const corrTokens: CorrectionDiffPart[] = [];
  let i = 0;
  let j = 0;

  while (i < m && j < n) {
    if (origWords[i] === corrWords[j]) {
      origTokens.push({ text: origWords[i]!, changed: false });
      corrTokens.push({ text: corrWords[j]!, changed: false });
      i++;
      j++;
    } else if ((dp[i + 1]?.[j] ?? 0) >= (dp[i]?.[j + 1] ?? 0)) {
      origTokens.push({ text: origWords[i]!, changed: true });
      i++;
    } else {
      corrTokens.push({ text: corrWords[j]!, changed: true });
      j++;
    }
  }
  while (i < m) {
    origTokens.push({ text: origWords[i++]!, changed: true });
  }
  while (j < n) {
    corrTokens.push({ text: corrWords[j++]!, changed: true });
  }

  return {
    originalParts: mergeAdjacentParts(origTokens),
    correctedParts: mergeAdjacentParts(corrTokens),
  };
}
