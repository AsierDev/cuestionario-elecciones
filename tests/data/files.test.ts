import { describe, expect, it } from 'vitest';

import { ANSWER_SCALE } from '../../src/core/config';
import { getApplicableParties, loadData } from '../../src/data/load';
import { validateDataReferences } from '../../src/data/schema';

const data = loadData();

const EXPECTED_PARTY_IDS = [
  'bng',
  'coalicion-canaria',
  'eh-bildu',
  'erc',
  'junts',
  'pnv',
  'podemos',
  'pp',
  'psoe',
  'sumar',
  'vox',
];

const ESTATAL_PARTY_IDS = ['psoe', 'pp', 'vox', 'sumar', 'podemos'];

const TERRITORY_PARTY_COUNTS: Record<string, number> = {
  cataluna: 7,
  'pais-vasco': 7,
  navarra: 6,
  galicia: 6,
  canarias: 6,
  andalucia: 5,
  ceuta: 5,
  melilla: 5,
};

const GLOBAL_COVERAGE_MIN = 0.75;
const ESTATAL_COVERAGE_MIN = 0.85;
const NOTE_MAX_LENGTH = 240;
const SCALE_VALUES = new Set(ANSWER_SCALE.map((point) => point.value));

describe('data/territories.json', () => {
  it('contiene los 19 territorios (17 CCAA + Ceuta y Melilla)', () => {
    expect(data.territories).toHaveLength(19);
  });
});

describe('data/topics.json', () => {
  it('agrupa el cuestionario en 10-12 temas sin solapamientos', () => {
    expect(data.topics.length).toBeGreaterThanOrEqual(10);
    expect(data.topics.length).toBeLessThanOrEqual(12);
  });

  it('describe cada tema y documenta su evidencia', () => {
    for (const topic of data.topics) {
      expect(topic.description.length).toBeGreaterThan(10);
      expect(topic.evidence.length).toBeGreaterThan(0);
    }
  });

  it('no cita Wikipedia', () => {
    const urls = data.topics.flatMap((topic) => topic.evidence.map((item) => item.sourceUrl));
    for (const url of urls) expect(url).not.toMatch(/wikipedia\.org/);
  });
});

describe('data/parties.json', () => {
  it('contiene los 11 partidos esperados', () => {
    expect(data.parties.map((party) => party.id).sort()).toEqual(EXPECTED_PARTY_IDS);
  });
});

describe('data/questions.json', () => {
  it('contiene 30 propuestas con ids únicos', () => {
    expect(data.questions).toHaveLength(30);
    expect(new Set(data.questions.map((question) => question.id)).size).toBe(30);
  });

  it('incluye al menos dos propuestas por tema', () => {
    for (const topic of data.topics) {
      const count = data.questions.filter((question) => question.topicId === topic.id).length;
      expect(count, `tema "${topic.id}"`).toBeGreaterThanOrEqual(2);
    }
  });

  it('agrupa las propuestas de un mismo tema de forma consecutiva', () => {
    const order = data.questions.map((question) => question.topicId);
    const seen = new Set<string>();
    for (let index = 0; index < order.length; index += 1) {
      const topicId = order[index] ?? '';
      if (index > 0 && order[index - 1] !== topicId) {
        expect(seen.has(topicId), `el tema "${topicId}" está partido`).toBe(false);
      }
      seen.add(topicId);
    }
  });
});

describe('data/positions/', () => {
  it('incluye un fichero por partido y una fila por propuesta', () => {
    const questionIds = data.questions.map((question) => question.id).sort();
    expect(Object.keys(data.positions).sort()).toEqual(EXPECTED_PARTY_IDS);
    for (const partyId of EXPECTED_PARTY_IDS) {
      const rows = data.positions[partyId] ?? [];
      expect(rows.map((row) => row.questionId).sort()).toEqual(questionIds);
    }
  });

  it('codifica cada posición en uno de los cinco puntos de la escala común', () => {
    for (const rows of Object.values(data.positions)) {
      for (const row of rows) {
        if (row.value !== null) expect(SCALE_VALUES.has(row.value)).toBe(true);
      }
    }
  });

  it('respeta la coherencia estado/sourceType/sourceDate en cada fila', () => {
    for (const rows of Object.values(data.positions)) {
      for (const row of rows) {
        if (row.value === null) {
          expect(row.status).toBe('sin-datos-suficientes');
          expect(row.sourceType).toBe('sin-datos');
          continue;
        }
        const recent = row.sourceType === 'programa-2026' || row.sourceDate >= '2026-01-01';
        expect(row.status).toBe(recent ? 'verificado' : 'provisional');
      }
    }
  });

  it('justifica cada posición con una nota breve', () => {
    for (const rows of Object.values(data.positions)) {
      for (const row of rows) {
        expect(row.note, `${row.questionId}`).toBeTruthy();
        expect(row.note?.length ?? 0).toBeLessThanOrEqual(NOTE_MAX_LENGTH);
      }
    }
  });

  it(`alcanza una cobertura global ≥${GLOBAL_COVERAGE_MIN * 100}%`, () => {
    const cells = Object.values(data.positions).flat();
    const withData = cells.filter((row) => row.value !== null).length;
    expect(withData / cells.length).toBeGreaterThanOrEqual(GLOBAL_COVERAGE_MIN);
  });

  it(`alcanza una cobertura ≥${ESTATAL_COVERAGE_MIN * 100}% en los partidos estatales`, () => {
    for (const partyId of ESTATAL_PARTY_IDS) {
      const rows = data.positions[partyId] ?? [];
      const withData = rows.filter((row) => row.value !== null).length;
      expect(withData / rows.length, partyId).toBeGreaterThanOrEqual(ESTATAL_COVERAGE_MIN);
    }
  });

  it('diferencia a los partidos: cada propuesta tiene posiciones a favor y en contra', () => {
    for (const question of data.questions) {
      const values = Object.values(data.positions)
        .map((rows) => rows.find((row) => row.questionId === question.id)?.value)
        .filter((value): value is number => typeof value === 'number');
      expect(Math.min(...values), question.id).toBeLessThan(0);
      expect(Math.max(...values), question.id).toBeGreaterThan(0);
    }
  });

  it('supera las referencias cruzadas del contrato', () => {
    expect(validateDataReferences(data)).toEqual([]);
  });
});

describe('getApplicableParties', () => {
  it('cuenta el subconjunto aplicable en cada territorio ancla', () => {
    for (const [territoryId, expected] of Object.entries(TERRITORY_PARTY_COUNTS)) {
      expect(getApplicableParties(data, territoryId)).toHaveLength(expected);
    }
  });

  it('excluye partidos territoriales fuera de su ámbito', () => {
    expect(getApplicableParties(data, 'andalucia').some((party) => party.id === 'erc')).toBe(false);
  });

  it('devuelve los partidos en orden alfabético por nombre', () => {
    const names = getApplicableParties(data, 'cataluna').map((party) => party.displayName);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'es')));
  });
});
