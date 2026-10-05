import { describe, expect, it } from 'vitest';

import { SCORING_CONFIG } from '../../src/core/config';
import {
  computeResults,
  getApplicableParties,
  questionAffinity,
  userPosition,
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

const ALFA = party('partido-a', { displayName: 'Alfa' });
const BETA = party('partido-b', { displayName: 'Beta' });
const GAMMA = party('partido-c', {
  displayName: 'Gamma',
  scope: 'territorial',
  communities: ['t2'],
});

function answer(questionId: string, optionIds: string[], priority = false): QuestionAnswer {
  return { questionId, optionIds, priority };
}

describe('userPosition', () => {
  it('devuelve el valor de la opción elegida en preguntas de opción única', () => {
    const q = question('q1', 'tema-1');
    expect(userPosition(q, ['q1-op0'])).toBe(-1);
    expect(userPosition(q, ['q1-op1'])).toBe(0);
    expect(userPosition(q, ['q1-op2'])).toBe(1);
  });

  it('devuelve la media aritmética de los valores seleccionados en preguntas múltiples', () => {
    const q = question('q1', 'tema-1', { type: 'multi' });
    expect(userPosition(q, ['q1-op0', 'q1-op2'])).toBe(0);
    expect(userPosition(q, ['q1-op0', 'q1-op1'])).toBeCloseTo(-0.5);
    expect(userPosition(q, ['q1-op2'])).toBe(1);
  });

  it('devuelve null cuando la pregunta se omite', () => {
    const q = question('q1', 'tema-1');
    expect(userPosition(q, [])).toBeNull();
  });

  it('rechaza varias opciones en una pregunta de opción única', () => {
    const q = question('q1', 'tema-1');
    expect(() => userPosition(q, ['q1-op0', 'q1-op2'])).toThrow();
  });

  it('rechaza una opción desconocida', () => {
    const q = question('q1', 'tema-1');
    expect(() => userPosition(q, ['q1-op9'])).toThrow();
  });
});

describe('questionAffinity', () => {
  it('vale 1 cuando la posición coincide con el partido', () => {
    expect(questionAffinity(1, 1)).toBe(1);
    expect(questionAffinity(0, 0)).toBe(1);
    expect(questionAffinity(-1, -1)).toBe(1);
  });

  it('vale 0 en los extremos opuestos del eje', () => {
    expect(questionAffinity(1, -1)).toBe(0);
    expect(questionAffinity(-1, 1)).toBe(0);
  });

  it('vale 0,5 a media distancia', () => {
    expect(questionAffinity(0, 1)).toBeCloseTo(0.5);
    expect(questionAffinity(0, -1)).toBeCloseTo(0.5);
    expect(questionAffinity(-0.5, 0.5)).toBeCloseTo(0.5);
  });

  it('es monótona: acercarse al partido nunca baja la afinidad', () => {
    const partyValue = 1;
    const affinities = [-1, -0.5, 0, 0.5, 1].map((user) => questionAffinity(user, partyValue));
    expect(affinities).toEqual([...affinities].sort((a, b) => a - b));
    expect(affinities[0]).toBe(0);
    expect(affinities[affinities.length - 1]).toBe(1);
  });
});

describe('getApplicableParties', () => {
  it('incluye siempre los partidos estatales y filtra los territoriales por comunidad', () => {
    const data = makeBundle({
      territories: [territory('t1'), territory('t2')],
      parties: [ALFA, BETA, GAMMA],
      topics: [],
      questions: [],
    });

    expect(getApplicableParties(data, 't1').map((p) => p.id)).toEqual(['partido-a', 'partido-b']);
    expect(getApplicableParties(data, 't2').map((p) => p.id)).toEqual([
      'partido-a',
      'partido-b',
      'partido-c',
    ]);
  });

  it('ordena alfabéticamente por nombre para mostrar', () => {
    const data = makeBundle({
      parties: [BETA, ALFA],
      topics: [],
      questions: [],
    });
    expect(getApplicableParties(data, 't1').map((p) => p.displayName)).toEqual(['Alfa', 'Beta']);
  });
});

describe('computeResults — fórmulas y ponderación', () => {
  it('da 100% con respuestas idénticas y cobertura completa', () => {
    const data = makeBundle({
      parties: [ALFA, BETA],
      topics: [topic('tema-1'), topic('tema-2')],
      questions: [question('q1', 'tema-1'), question('q2', 'tema-2')],
      positions: {
        'partido-a': [position('tema-1', 1), position('tema-2', 1)],
        'partido-b': [position('tema-1', -1), position('tema-2', -1)],
      },
    });

    const results = computeResults(data, {
      territoryId: 't1',
      answers: [answer('q1', ['q1-op2']), answer('q2', ['q2-op2'])],
    });

    expect(results.ranking[0]?.party.id).toBe('partido-a');
    expect(results.ranking[0]?.affinity).toBe(1);
    expect(results.ranking[0]?.coverage).toBe(1);
    expect(results.ranking[1]?.party.id).toBe('partido-b');
    expect(results.ranking[1]?.affinity).toBe(0);
  });

  it('da 0% con respuestas opuestas', () => {
    const data = makeBundle({
      parties: [ALFA],
      topics: [topic('tema-1'), topic('tema-2')],
      questions: [question('q1', 'tema-1'), question('q2', 'tema-2')],
      positions: { 'partido-a': [position('tema-1', 1), position('tema-2', 1)] },
    });

    const results = computeResults(data, {
      territoryId: 't1',
      answers: [answer('q1', ['q1-op0']), answer('q2', ['q2-op0'])],
    });

    expect(results.ranking[0]?.affinity).toBe(0);
  });

  it('aplica el factor de prioridad ×1,5 en la media ponderada', () => {
    const data = makeBundle({
      parties: [ALFA],
      topics: [topic('tema-1'), topic('tema-2')],
      questions: [question('q1', 'tema-1'), question('q2', 'tema-2')],
      positions: { 'partido-a': [position('tema-1', 1), position('tema-2', 0)] },
    });

    const weighted = computeResults(data, {
      territoryId: 't1',
      answers: [answer('q1', ['q1-op2'], true), answer('q2', ['q2-op2'])],
    });
    const plain = computeResults(data, {
      territoryId: 't1',
      answers: [answer('q1', ['q1-op2']), answer('q2', ['q2-op2'])],
    });

    expect(SCORING_CONFIG.priorityFactor).toBe(1.5);
    expect(weighted.ranking[0]?.affinity).toBeCloseTo(0.8);
    expect(plain.ranking[0]?.affinity).toBeCloseTo(0.75);
    expect(weighted.totalWeight).toBeCloseTo(2.5);
  });

  it('trata las preguntas múltiples por la media de las opciones marcadas', () => {
    const data = makeBundle({
      parties: [ALFA],
      topics: [topic('tema-1')],
      questions: [question('q1', 'tema-1', { type: 'multi' })],
      positions: { 'partido-a': [position('tema-1', 0)] },
    });

    const balanced = computeResults(data, {
      territoryId: 't1',
      answers: [answer('q1', ['q1-op0', 'q1-op2'])],
    });
    const oneSide = computeResults(data, {
      territoryId: 't1',
      answers: [answer('q1', ['q1-op0'])],
    });

    expect(balanced.ranking[0]?.affinity).toBe(1);
    expect(oneSide.ranking[0]?.affinity).toBeCloseTo(0.5);
  });

  it('excluye del denominador las preguntas omitidas', () => {
    const data = makeBundle({
      parties: [ALFA],
      topics: [topic('tema-1'), topic('tema-2')],
      questions: [question('q1', 'tema-1'), question('q2', 'tema-2')],
      positions: { 'partido-a': [position('tema-1', 0), position('tema-2', 1)] },
    });

    const results = computeResults(data, {
      territoryId: 't1',
      answers: [answer('q1', ['q1-op1']), answer('q2', [])],
    });

    expect(results.answeredCount).toBe(1);
    expect(results.totalWeight).toBe(1);
    expect(results.ranking[0]?.affinity).toBe(1);
    expect(results.ranking[0]?.coverage).toBe(1);
  });

  it('calcula la cobertura ponderada por el peso de los temas respondidos', () => {
    const data = makeBundle({
      parties: [ALFA],
      topics: [topic('tema-1'), topic('tema-2')],
      questions: [question('q1', 'tema-1'), question('q2', 'tema-2')],
      positions: { 'partido-a': [position('tema-1', 0)] },
    });

    const results = computeResults(data, {
      territoryId: 't1',
      answers: [answer('q1', ['q1-op1'], true), answer('q2', ['q2-op1'])],
    });

    expect(results.ranking[0]?.coverage).toBeCloseTo(0.6);
    expect(results.ranking[0]?.missingTopicIds).toEqual(['tema-2']);
  });

  it('marcar como prioritario un tema sin dato no cambia la afinidad pero reduce la cobertura', () => {
    const data = makeBundle({
      parties: [ALFA],
      topics: [topic('tema-1'), topic('tema-2')],
      questions: [question('q1', 'tema-1'), question('q2', 'tema-2')],
      positions: { 'partido-a': [position('tema-1', 0)] },
    });

    const plain = computeResults(data, {
      territoryId: 't1',
      answers: [answer('q1', ['q1-op1']), answer('q2', ['q2-op1'])],
    });
    const prioritized = computeResults(data, {
      territoryId: 't1',
      answers: [answer('q1', ['q1-op1']), answer('q2', ['q2-op1'], true)],
    });

    expect(prioritized.ranking[0]?.affinity).toBeCloseTo(plain.ranking[0]?.affinity ?? 0);
    expect(plain.ranking[0]?.coverage).toBeCloseTo(0.5);
    expect(prioritized.ranking[0]?.coverage).toBeCloseTo(0.4);
  });
});

describe('computeResults — filtrado territorial', () => {
  it('solo puntúa los partidos votables en el territorio y lista aparte los no aplicables', () => {
    const data = makeBundle({
      territories: [territory('t1'), territory('t2')],
      parties: [ALFA, GAMMA],
      topics: [topic('tema-1')],
      questions: [question('q1', 'tema-1')],
      positions: {
        'partido-a': [position('tema-1', 0)],
        'partido-c': [position('tema-1', 1)],
      },
    });

    const t1 = computeResults(data, { territoryId: 't1', answers: [answer('q1', ['q1-op1'])] });
    expect(t1.applicableParties.map((p) => p.id)).toEqual(['partido-a']);
    expect(t1.nonApplicableParties.map((p) => p.id)).toEqual(['partido-c']);
    expect(t1.ranking.map((score) => score.party.id)).toEqual(['partido-a']);

    const t2 = computeResults(data, { territoryId: 't2', answers: [answer('q1', ['q1-op1'])] });
    expect(t2.applicableParties.map((p) => p.id)).toEqual(['partido-a', 'partido-c']);
    expect(t2.nonApplicableParties).toEqual([]);
    expect(t2.ranking).toHaveLength(2);
  });
});

describe('computeResults — empates', () => {
  it('incluye todos los ganadores empatados ordenados alfabéticamente', () => {
    const data = makeBundle({
      parties: [BETA, ALFA],
      topics: [topic('tema-1')],
      questions: [question('q1', 'tema-1')],
      positions: {
        'partido-a': [position('tema-1', 0)],
        'partido-b': [position('tema-1', 0)],
      },
    });

    const results = computeResults(data, {
      territoryId: 't1',
      answers: [answer('q1', ['q1-op1'])],
    });

    expect(results.questions[0]?.winners.map((p) => p.id)).toEqual(['partido-a', 'partido-b']);
    expect(results.questions[0]?.bestAffinity).toBe(1);
    expect(results.ranking.map((score) => score.party.id)).toEqual(['partido-a', 'partido-b']);
  });
});

describe('computeResults — estados borde', () => {
  it('con todas las preguntas omitidas deja afinidad y cobertura a null y sin ranking', () => {
    const { topics, questions } = manyQuestions(25);
    const data = makeBundle({
      parties: [ALFA],
      topics,
      questions,
      positions: { 'partido-a': topics.map((item) => position(item.id, 0)) },
    });

    const results = computeResults(data, {
      territoryId: 't1',
      answers: questions.map((item) => answer(item.id, [])),
    });

    expect(results.hasAnswers).toBe(false);
    expect(results.answeredCount).toBe(0);
    expect(results.totalWeight).toBe(0);
    expect(results.ranking).toEqual([]);
    expect(results.withoutData).toEqual([]);
    expect(results.questions).toEqual([]);
    expect(JSON.stringify(results)).not.toContain('NaN');
  });

  it('deja ganadores vacíos y reduce la cobertura cuando ningún partido aplicable tiene dato', () => {
    const data = makeBundle({
      parties: [ALFA, BETA],
      topics: [topic('tema-1'), topic('tema-2')],
      questions: [question('q1', 'tema-1'), question('q2', 'tema-2')],
      positions: {
        'partido-a': [position('tema-1', 0), position('tema-2', null)],
        'partido-b': [position('tema-1', null), position('tema-2', null)],
      },
    });

    const results = computeResults(data, {
      territoryId: 't1',
      answers: [answer('q1', ['q1-op1']), answer('q2', ['q2-op1'])],
    });

    expect(results.questions[0]?.winners.map((p) => p.id)).toEqual(['partido-a']);
    expect(results.questions[1]?.winners).toEqual([]);
    expect(results.questions[1]?.bestAffinity).toBeNull();

    expect(results.ranking.map((score) => score.party.id)).toEqual(['partido-a']);
    expect(results.ranking[0]?.coverage).toBeCloseTo(0.5);
    expect(results.ranking[0]?.missingTopicIds).toEqual(['tema-2']);
    expect(results.withoutData.map((score) => score.party.id)).toEqual(['partido-b']);
    expect(results.withoutData[0]?.coverage).toBe(0);
  });
});

describe('computeResults — datos provisionales', () => {
  it('marca provisional cuando alguna posición puntuada lo es', () => {
    const data = makeBundle({
      parties: [ALFA],
      topics: [topic('tema-1')],
      questions: [question('q1', 'tema-1')],
      positions: { 'partido-a': [position('tema-1', 0, { status: 'provisional' })] },
    });

    const results = computeResults(data, {
      territoryId: 't1',
      answers: [answer('q1', ['q1-op1'])],
    });

    expect(results.provisional).toBe(true);
    expect(results.ranking[0]?.provisional).toBe(true);
  });

  it('no marca provisional cuando todas las posiciones puntuadas son verificadas', () => {
    const data = makeBundle({
      parties: [ALFA],
      topics: [topic('tema-1')],
      questions: [question('q1', 'tema-1')],
      positions: { 'partido-a': [position('tema-1', 0)] },
    });

    const results = computeResults(data, {
      territoryId: 't1',
      answers: [answer('q1', ['q1-op1'])],
    });

    expect(results.provisional).toBe(false);
    expect(results.ranking[0]?.provisional).toBe(false);
  });
});

describe('computeResults — determinismo', () => {
  it('produce el mismo resultado en dos ejecuciones', () => {
    const data = makeBundle({
      parties: [ALFA, BETA, GAMMA],
      topics: [topic('tema-1'), topic('tema-2')],
      questions: [question('q1', 'tema-1'), question('q2', 'tema-2')],
      positions: {
        'partido-a': [position('tema-1', 0.5), position('tema-2', -1)],
        'partido-b': [position('tema-1', -0.5), position('tema-2', null)],
      },
    });

    const input = {
      territoryId: 't1',
      answers: [answer('q1', ['q1-op2'], true), answer('q2', ['q2-op0'])],
    };

    expect(computeResults(data, input)).toEqual(computeResults(data, input));
  });
});
