import { describe, expect, it } from 'vitest';

import { loadData } from '../../src/data/load';

const data = loadData();

const normalize = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const questionFields = (question: (typeof data.questions)[number]): string[] => [
  question.text,
  ...(question.axisNote ? [question.axisNote] : []),
  ...question.options.map((option) => option.label),
];

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const partyTokens = data.parties.flatMap((party) =>
  normalize(party.displayName)
    .split(/[\s-]+/)
    .filter((token) => token.length >= 2),
);

const PARTY_ALIASES = [
  'psoe',
  'pp',
  'vox',
  'sumar',
  'podemos',
  'erc',
  'junts',
  'pnv',
  'bildu',
  'bng',
  'coalicion',
  'canaria',
  'popular',
  'socialista',
  'socialistas',
  'izquierda',
  'derecha',
  'progresista',
  'conservador',
  'conservadora',
];

const PERSON_TOKENS = [
  'feijoo',
  'sanchez',
  'abascal',
  'yolanda',
  'diaz',
  'montero',
  'puigdemont',
  'aragones',
  'tezanos',
];

const DISALLOWED_FRAMING = [
  'endurecer',
  'abaratar',
  'restrictiv',
  'extrem',
  'aunque suba',
  'frente a la',
  'reduciendo garant',
];

const AXIS_PATTERN = /^-1: .+ \| \+1: .+$/;

describe('catálogo de preguntas', () => {
  it('contiene exactamente 25 preguntas', () => {
    expect(data.questions).toHaveLength(25);
  });

  it('es una biyección con los temas (una pregunta por tema)', () => {
    const topicIds = data.topics.map((topic) => topic.id).sort();
    const questionTopicIds = data.questions.map((question) => question.topicId).sort();
    expect(questionTopicIds).toEqual(topicIds);
  });

  it('usa ids de pregunta únicos', () => {
    const ids = data.questions.map((question) => question.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('referencia solo temas existentes', () => {
    const topicIds = new Set(data.topics.map((topic) => topic.id));
    for (const question of data.questions) {
      expect(topicIds.has(question.topicId)).toBe(true);
    }
  });

  it('incluye al menos 5 preguntas de opción única y 5 de opción múltiple', () => {
    const single = data.questions.filter((question) => question.type === 'single').length;
    const multi = data.questions.filter((question) => question.type === 'multi').length;
    expect(single).toBeGreaterThanOrEqual(5);
    expect(multi).toBeGreaterThanOrEqual(5);
  });

  it('usa enunciados de hasta 200 caracteres y etiquetas de hasta 120', () => {
    for (const question of data.questions) {
      expect(question.text.length).toBeLessThanOrEqual(200);
      for (const option of question.options) {
        expect(option.label.length).toBeLessThanOrEqual(120);
      }
    }
  });

  it('ofrece entre 3 y 5 opciones por pregunta', () => {
    for (const question of data.questions) {
      expect(question.options.length).toBeGreaterThanOrEqual(3);
      expect(question.options.length).toBeLessThanOrEqual(5);
    }
  });

  it('usa valores distintos dentro de [-1,1]', () => {
    for (const question of data.questions) {
      const values = question.options.map((option) => option.value);
      expect(new Set(values).size).toBe(values.length);
      for (const value of values) {
        expect(value).toBeGreaterThanOrEqual(-1);
        expect(value).toBeLessThanOrEqual(1);
      }
    }
  });

  it('cubre ambos lados del eje (al menos un valor negativo y uno positivo)', () => {
    for (const question of data.questions) {
      const values = question.options.map((option) => option.value);
      expect(values.some((value) => value < 0)).toBe(true);
      expect(values.some((value) => value > 0)).toBe(true);
    }
  });
});

describe('convención de signo del eje', () => {
  it('declara en axisNote el significado de -1 y +1 en las 25 preguntas', () => {
    for (const question of data.questions) {
      expect(question.axisNote, `pregunta "${question.id}" sin axisNote`).toBeDefined();
      expect(question.axisNote, `pregunta "${question.id}" con axisNote no canónico`).toMatch(
        AXIS_PATTERN,
      );
    }
  });

  it('ordena las opciones por valor ascendente, de -1 a +1', () => {
    for (const question of data.questions) {
      const values = question.options.map((option) => option.value);
      expect(values, `pregunta "${question.id}"`).toEqual([...values].sort((a, b) => a - b));
      expect(Math.min(...values), `pregunta "${question.id}"`).toBe(-1);
      expect(Math.max(...values), `pregunta "${question.id}"`).toBe(1);
    }
  });
});

describe('neutralidad del enunciado y las opciones', () => {
  it('no menciona nombres de partidos ni sus alias', () => {
    const blocked = [...new Set([...partyTokens, ...PARTY_ALIASES])];
    for (const question of data.questions) {
      for (const field of questionFields(question)) {
        const normalizedField = normalize(field);
        for (const token of blocked) {
          expect(
            new RegExp(`\\b${escapeRegExp(token)}\\b`).test(normalizedField),
            `"${token}" aparece en "${field}"`,
          ).toBe(false);
        }
      }
    }
  });

  it('no menciona nombres de personas', () => {
    for (const question of data.questions) {
      for (const field of questionFields(question)) {
        const normalizedField = normalize(field);
        for (const token of PERSON_TOKENS) {
          expect(
            new RegExp(`\\b${escapeRegExp(token)}\\b`).test(normalizedField),
            `"${token}" aparece en "${field}"`,
          ).toBe(false);
        }
      }
    }
  });

  it('no usa formulaciones descalificativas ni presuposiciones', () => {
    for (const question of data.questions) {
      for (const field of questionFields(question)) {
        const normalizedField = normalize(field);
        for (const token of DISALLOWED_FRAMING) {
          expect(
            normalizedField.includes(token),
            `"${token}" aparece en "${field}"`,
          ).toBe(false);
        }
      }
    }
  });
});
