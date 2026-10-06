import { describe, expect, it } from 'vitest';

import { ANSWER_SCALE, nearestScalePoint, SCORING_CONFIG } from '../../src/core/config';
import {
  computeResults,
  getApplicableParties,
  questionAffinity,
  summarizeAgreement,
  type QuestionAnswer,
} from '../../src/core/scoring';
import {
  makeBundle,
  manyQuestions,
  party,
  position,
  question,
  territory,
  topic,
} from '../fixtures/scoring';

const answer = (questionId: string, value: number, priority = false): QuestionAnswer => ({
  questionId,
  value,
  priority,
});

describe('escala común', () => {
  it('tiene cinco puntos simétricos de −1 a +1', () => {
    expect(ANSWER_SCALE.map((point) => point.value)).toEqual([-1, -0.5, 0, 0.5, 1]);
  });

  it('asigna cada valor al punto más cercano', () => {
    expect(nearestScalePoint(0.7).value).toBe(0.5);
    expect(nearestScalePoint(-0.9).value).toBe(-1);
  });
});

describe('questionAffinity', () => {
  it('vale 1 con la misma posición y 0 en extremos opuestos', () => {
    expect(questionAffinity(1, 1)).toBe(1);
    expect(questionAffinity(-1, 1)).toBe(0);
  });

  it('pierde un 25 % por cada punto de distancia en la escala', () => {
    expect(questionAffinity(0.5, 0)).toBeCloseTo(0.75);
    expect(questionAffinity(1, 0)).toBeCloseTo(0.5);
  });
});

describe('computeResults', () => {
  const twoTopics = () => {
    const topics = [topic('ta'), topic('tb')];
    const questions = [question('q1', 'ta'), question('q2', 'ta'), question('q3', 'tb')];
    return makeBundle({
      parties: [party('a', { displayName: 'Alfa' }), party('b', { displayName: 'Beta' })],
      topics,
      questions,
      positions: {
        a: [position('q1', 1), position('q2', 1), position('q3', -1)],
        b: [position('q1', -1), position('q2', null), position('q3', 1)],
      },
    });
  };

  it('calcula la afinidad media por partido sobre las preguntas con dato', () => {
    const results = computeResults(twoTopics(), {
      territoryId: 't1',
      answers: [answer('q1', 1), answer('q2', 0.5), answer('q3', 1)],
    });
    const alfa = results.ranking.find((score) => score.party.id === 'a');
    const beta = results.ranking.find((score) => score.party.id === 'b');
    expect(alfa?.affinity).toBeCloseTo((1 + 0.75 + 0) / 3);
    expect(beta?.affinity).toBeCloseTo((0 + 1) / 2);
    expect(beta?.comparedCount).toBe(2);
    expect(beta?.missingQuestionIds).toEqual(['q2']);
    expect(beta?.coverage).toBeCloseTo(2 / 3);
  });

  it('pondera ×1,5 las propuestas de temas prioritarios', () => {
    const results = computeResults(twoTopics(), {
      territoryId: 't1',
      answers: [answer('q1', 1), answer('q3', 1, true)],
    });
    const alfa = results.ranking.find((score) => score.party.id === 'a');
    const expected = (1 * 1 + SCORING_CONFIG.priorityFactor * 0) / (1 + SCORING_CONFIG.priorityFactor);
    expect(alfa?.affinity).toBeCloseTo(expected);
    expect(results.totalWeight).toBeCloseTo(1 + SCORING_CONFIG.priorityFactor);
  });

  it('calcula la afinidad por tema y marca al más cercano en cada uno', () => {
    const results = computeResults(twoTopics(), {
      territoryId: 't1',
      answers: [answer('q1', 1), answer('q2', 1), answer('q3', 1)],
    });
    const ta = results.topics.find((item) => item.topic.id === 'ta');
    const tb = results.topics.find((item) => item.topic.id === 'tb');
    expect(ta?.answeredCount).toBe(2);
    expect(ta?.winners.map((p) => p.id)).toEqual(['a']);
    expect(ta?.parties.find((p) => p.party.id === 'b')?.affinity).toBeCloseTo(0);
    expect(tb?.winners.map((p) => p.id)).toEqual(['b']);
  });

  it('omite los temas sin respuestas', () => {
    const results = computeResults(twoTopics(), { territoryId: 't1', answers: [answer('q3', 0)] });
    expect(results.topics.map((item) => item.topic.id)).toEqual(['tb']);
  });

  it('muestra todos los empatados en cabeza de una propuesta, en orden alfabético', () => {
    const data = makeBundle({
      parties: [party('z', { displayName: 'Zeta' }), party('a', { displayName: 'Alfa' })],
      topics: [topic('t')],
      questions: [question('q1', 't')],
      positions: { z: [position('q1', 0.5)], a: [position('q1', 0.5)] },
    });
    const results = computeResults(data, { territoryId: 't1', answers: [answer('q1', 1)] });
    expect(results.questions[0]?.winners.map((p) => p.displayName)).toEqual(['Alfa', 'Zeta']);
    expect(results.questions[0]?.bestAffinity).toBeCloseTo(0.75);
  });

  it('ordena las respuestas como el cuestionario aunque lleguen desordenadas', () => {
    const results = computeResults(twoTopics(), {
      territoryId: 't1',
      answers: [answer('q3', 1), answer('q1', 1)],
    });
    expect(results.questions.map((item) => item.question.id)).toEqual(['q1', 'q3']);
  });

  it('rechaza valores fuera de la escala y preguntas inexistentes', () => {
    expect(() =>
      computeResults(twoTopics(), { territoryId: 't1', answers: [answer('q1', 0.3)] }),
    ).toThrow(/no válido/);
    expect(() =>
      computeResults(twoTopics(), { territoryId: 't1', answers: [answer('q9', 1)] }),
    ).toThrow(/no existe/);
  });

  it('sin respuestas no produce porcentajes ni NaN', () => {
    const results = computeResults(twoTopics(), { territoryId: 't1', answers: [] });
    expect(results.hasAnswers).toBe(false);
    expect(results.ranking).toEqual([]);
    expect(results.topics).toEqual([]);
  });

  it('separa partidos sin datos y no aplicables en el territorio', () => {
    const data = makeBundle({
      territories: [territory('t1'), territory('t2')],
      parties: [
        party('a'),
        party('b'),
        party('local', { scope: 'territorial', communities: ['t2'] }),
      ],
      topics: [topic('t')],
      questions: [question('q1', 't')],
      positions: { a: [position('q1', 1)], b: [position('q1', null)], local: [position('q1', 1)] },
    });
    const results = computeResults(data, { territoryId: 't1', answers: [answer('q1', 1)] });
    expect(results.withoutData.map((score) => score.party.id)).toEqual(['b']);
    expect(results.nonApplicableParties.map((p) => p.id)).toEqual(['local']);
    expect(getApplicableParties(data, 't2').map((p) => p.id)).toContain('local');
  });

  it('exige un mínimo de propuestas comparadas y cobertura para entrar en el ranking', () => {
    const { topics, questions } = manyQuestions(SCORING_CONFIG.minComparedQuestions + 2);
    const full = questions.map((item) => position(item.id, 1));
    const sparse = questions.map((item, index) => position(item.id, index < 3 ? 1 : null));
    const data = makeBundle({
      parties: [party('full'), party('sparse')],
      topics,
      questions,
      positions: { full, sparse },
    });
    const results = computeResults(data, {
      territoryId: 't1',
      answers: questions.map((item) => answer(item.id, 1)),
    });
    expect(results.partialComparison).toBe(false);
    expect(results.ranking.find((s) => s.party.id === 'full')?.eligible).toBe(true);
    expect(results.lowCoverage.map((s) => s.party.id)).toEqual(['sparse']);
  });

  it('avisa de comparación parcial con pocas respuestas', () => {
    const results = computeResults(twoTopics(), { territoryId: 't1', answers: [answer('q1', 1)] });
    expect(results.partialComparison).toBe(true);
    expect(results.ranking.every((score) => !score.eligible)).toBe(true);
  });

  it('marca el resultado como provisional si alguna posición lo es', () => {
    const data = makeBundle({
      parties: [party('a')],
      topics: [topic('t')],
      questions: [question('q1', 't')],
      positions: { a: [position('q1', 1, { status: 'provisional' })] },
    });
    const results = computeResults(data, { territoryId: 't1', answers: [answer('q1', 1)] });
    expect(results.provisional).toBe(true);
  });
});

describe('summarizeAgreement', () => {
  it('separa las coincidencias claras de las discrepancias claras', () => {
    const { topics, questions } = manyQuestions(5);
    const data = makeBundle({
      parties: [party('a')],
      topics,
      questions,
      positions: {
        a: [
          position('q1', 1),
          position('q2', 0.5),
          position('q3', 0),
          position('q4', -0.5),
          position('q5', -1),
        ],
      },
    });
    const results = computeResults(data, {
      territoryId: 't1',
      answers: questions.map((item) => answer(item.id, 1)),
    });
    const score = results.ranking[0];
    if (!score) throw new Error('sin puntuación');
    const { agreements, disagreements } = summarizeAgreement(score);
    expect(agreements.map((item) => item.question.id)).toEqual(['q1', 'q2']);
    expect(disagreements.map((item) => item.question.id)).toEqual(['q5', 'q4', 'q3']);
  });
});
