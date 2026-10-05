import { describe, expect, it } from 'vitest';

import type { PartyScore } from '../../src/core/scoring';
import {
  compareAffinityDescending,
  formatDate,
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
    missingTopicIds: [],
    provisional: false,
  };
}

describe('formatos de porcentaje y redondeo', () => {
  it('redondea a un decimal', () => {
    expect(roundToDecimals(0.6666)).toBe(0.7);
    expect(roundToDecimals(0.05)).toBe(0.1);
    expect(roundToDecimals(1)).toBe(1);
  });

  it('formatea porcentajes con un decimal y coma decimal', () => {
    expect(formatPercent(0.6666)).toBe('66,7 %');
    expect(formatPercent(1)).toBe('100,0 %');
    expect(formatPercent(0)).toBe('0,0 %');
  });

  it('formatea fechas ISO como día/mes/año', () => {
    expect(formatDate('2026-10-05')).toBe('05/10/2026');
  });
});

describe('orden del ranking', () => {
  it('ordena por afinidad descendente y desempata alfabéticamente', () => {
    const sorted = sortRanking([
      score('Beta', 0.5),
      score('Alfa', 0.8),
      score('Gamma', 0.5),
    ]);

    expect(sorted.map((entry) => entry.party.displayName)).toEqual(['Alfa', 'Beta', 'Gamma']);
  });

  it('compara afinidades iguales por nombre', () => {
    expect(compareAffinityDescending(score('Alfa', 0.5), score('Beta', 0.5))).toBeLessThan(0);
    expect(compareAffinityDescending(score('Beta', 0.5), score('Alfa', 0.5))).toBeGreaterThan(0);
  });
});
