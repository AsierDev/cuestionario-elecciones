import { describe, expect, it } from 'vitest';

import type { PartyScore } from '../../src/core/scoring';
import {
  compareAffinityDescending,
  formatDate,
  formatFactor,
  formatList,
  formatPercent,
  roundToDecimals,
  sortRanking,
} from '../../src/ui/format';
import { party } from '../fixtures/scoring';

function score(displayName: string, affinity: number | null): PartyScore {
  return {
    party: party(displayName.toLowerCase(), { displayName }),
    affinity,
    coverage: 1,
    comparedCount: 1,
    answeredCount: 1,
    eligible: false,
    missingQuestionIds: [],
    provisional: false,
    comparisons: [],
    topics: [],
  };
}

describe('formatos', () => {
  it('redondea y formatea porcentajes sin decimales y con espacio fino', () => {
    expect(roundToDecimals(0.6666)).toBe(1);
    expect(formatPercent(0.6666)).toBe('67 %');
    expect(formatPercent(1)).toBe('100 %');
    expect(formatPercent(0)).toBe('0 %');
  });

  it('admite decimales explícitos con coma decimal', () => {
    expect(formatPercent(0.6666, 1)).toBe('66,7 %');
  });

  it('formatea factores, fechas y listas en español', () => {
    expect(formatFactor(1.5)).toBe('1,5');
    expect(formatDate('2026-10-05')).toBe('05/10/2026');
    expect(formatList(['A'])).toBe('A');
    expect(formatList(['A', 'B'])).toBe('A y B');
    expect(formatList(['A', 'B', 'C'])).toBe('A, B y C');
  });
});

describe('orden del ranking', () => {
  it('ordena por afinidad descendente y desempata alfabéticamente', () => {
    const sorted = sortRanking([score('Beta', 0.5), score('Alfa', 0.8), score('Gamma', 0.5)]);
    expect(sorted.map((entry) => entry.party.displayName)).toEqual(['Alfa', 'Beta', 'Gamma']);
  });

  it('compara afinidades iguales por nombre', () => {
    expect(compareAffinityDescending(score('Alfa', 0.5), score('Beta', 0.5))).toBeLessThan(0);
  });
});
