import { describe, expect, it } from 'vitest';

import { ANSWER_SCALE } from '../../src/core/config';
import { computeResults, type QuestionAnswer } from '../../src/core/scoring';
import { loadData } from '../../src/data/load';

const data = loadData();

function answerAll(value: number): QuestionAnswer[] {
  return data.questions.map((question) => ({ questionId: question.id, value, priority: false }));
}

// Responde lo mismo que el partido allí donde tiene posición documentada.
function mirror(partyId: string): QuestionAnswer[] {
  const rows = data.positions[partyId] ?? [];
  return rows
    .filter((row) => row.value !== null)
    .map((row) => ({ questionId: row.questionId, value: row.value ?? 0, priority: false }));
}

describe('integración con los datos reales', () => {
  it('calcula resultados en todos los territorios sin errores ni NaN', () => {
    for (const territory of data.territories) {
      for (const point of ANSWER_SCALE) {
        const results = computeResults(data, { territoryId: territory.id, answers: answerAll(point.value) });
        for (const score of results.ranking) {
          expect(Number.isFinite(score.affinity)).toBe(true);
          expect(score.affinity).toBeGreaterThanOrEqual(0);
          expect(score.affinity).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('solo compara partidos que concurren en el territorio', () => {
    const results = computeResults(data, { territoryId: 'andalucia', answers: answerAll(1) });
    const ids = results.applicableParties.map((party) => party.id);
    expect(ids).toEqual(expect.arrayContaining(['pp', 'psoe', 'vox', 'sumar', 'podemos']));
    expect(ids).not.toContain('erc');
  });

  it.each(['psoe', 'pp', 'vox', 'sumar', 'podemos'])(
    'quien responde como %s obtiene a ese partido en cabeza con un 100 %%',
    (partyId) => {
      const results = computeResults(data, { territoryId: 'madrid', answers: mirror(partyId) });
      const top = results.ranking.filter((score) => score.eligible)[0];
      expect(top?.affinity).toBeCloseTo(1);
      const leaders = results.ranking.filter((score) => score.affinity === top?.affinity);
      expect(leaders.map((score) => score.party.id)).toContain(partyId);
    },
  );

  it('agrupa los resultados por todos los temas cuando se responde todo', () => {
    const results = computeResults(data, { territoryId: 'cataluna', answers: answerAll(0) });
    expect(results.topics).toHaveLength(data.topics.length);
    expect(results.questions).toHaveLength(data.questions.length);
  });
});
