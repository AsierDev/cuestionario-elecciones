import { describe, expect, it } from 'vitest';

import { loadData } from '../../src/data/load';

const data = loadData();
type QuestionItem = (typeof data.questions)[number];

const normalize = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Todo lo que lee la persona usuaria durante el cuestionario.
const allFields = (question: QuestionItem): string[] => [
  question.title,
  question.statement,
  question.summary,
  question.context,
  question.change,
  question.ifFavor,
  question.ifAgainst,
  ...question.glossary.flatMap((entry) => [entry.term, entry.definition]),
];

// La propuesta en sí: debe formularse sin carga valorativa.
const proposalFields = (question: QuestionItem): string[] => [
  question.title,
  question.statement,
  question.summary,
];

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
  'coalicion canaria',
  'popular',
  'socialista',
  'socialistas',
  'izquierda',
  'derecha',
  'progresista',
  'conservador',
  'conservadora',
];

const PERSON_TOKENS = ['feijoo', 'sanchez', 'abascal', 'yolanda', 'diaz', 'montero', 'puigdemont'];

const LOADED_FRAMING = ['ilegales', 'okupa', 'mordaza', 'chiringuito', 'adoctrina', 'extrem', 'sentido comun'];

function containsToken(field: string, token: string): boolean {
  return new RegExp(`\\b${escapeRegExp(token)}\\b`).test(normalize(field));
}

describe('legibilidad de las propuestas', () => {
  it('plantea una sola medida por enunciado, de hasta 220 caracteres', () => {
    for (const question of data.questions) {
      expect(question.statement.length, question.id).toBeLessThanOrEqual(220);
      expect(question.title.length, question.id).toBeLessThanOrEqual(60);
    }
  });

  it('explica situación actual, cambio y consecuencias en ambos sentidos', () => {
    for (const question of data.questions) {
      for (const field of [question.context, question.change, question.ifFavor, question.ifAgainst]) {
        expect(field.length, question.id).toBeGreaterThan(40);
      }
    }
  });

  it('expone el coste de cada postura («aunque…») tanto a favor como en contra', () => {
    for (const question of data.questions) {
      expect(normalize(question.ifFavor), question.id).toContain('aunque');
      expect(normalize(question.ifAgainst), question.id).toContain('aunque');
    }
  });
});

describe('neutralidad', () => {
  it('no menciona partidos ni sus alias en ningún texto del cuestionario', () => {
    const blocked = [...new Set([...partyTokens, ...PARTY_ALIASES])];
    for (const question of data.questions) {
      for (const field of allFields(question)) {
        for (const token of blocked) {
          expect(containsToken(field, token), `"${token}" aparece en "${field}"`).toBe(false);
        }
      }
    }
  });

  it('no menciona a personas', () => {
    for (const question of data.questions) {
      for (const field of allFields(question)) {
        for (const token of PERSON_TOKENS) {
          expect(containsToken(field, token), `"${token}" aparece en "${field}"`).toBe(false);
        }
      }
    }
  });

  it('formula las propuestas sin términos cargados', () => {
    for (const question of data.questions) {
      for (const field of proposalFields(question)) {
        for (const token of LOADED_FRAMING) {
          expect(normalize(field).includes(token), `"${token}" aparece en "${field}"`).toBe(false);
        }
      }
    }
  });
});
