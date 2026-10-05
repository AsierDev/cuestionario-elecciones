import { describe, expect, it } from 'vitest';

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

describe('data/territories.json', () => {
  it('contiene los 19 territorios (17 CCAA + Ceuta y Melilla)', () => {
    expect(data.territories).toHaveLength(19);
  });

  it('usa ids únicos', () => {
    const ids = data.territories.map((territory) => territory.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('data/topics.json', () => {
  it('contiene exactamente 25 temas', () => {
    expect(data.topics).toHaveLength(25);
  });

  it('reparte 13 temas en el bloque A y 12 en el bloque B', () => {
    expect(data.topics.filter((topic) => topic.block === 'A')).toHaveLength(13);
    expect(data.topics.filter((topic) => topic.block === 'B')).toHaveLength(12);
  });

  it('respaldan el bloque A con evidencia CIS y valor numérico', () => {
    for (const topic of data.topics.filter((item) => item.block === 'A')) {
      const cis = topic.evidence.filter(
        (evidence) => evidence.type === 'cis-ranking' || evidence.type === 'cis-survey',
      );
      expect(cis.length).toBeGreaterThan(0);
      expect(cis.every((evidence) => typeof evidence.value === 'number')).toBe(true);
    }
  });

  it('respaldan el bloque B con evidencia de agenda', () => {
    for (const topic of data.topics.filter((item) => item.block === 'B')) {
      expect(topic.evidence.some((evidence) => evidence.type === 'agenda')).toBe(true);
    }
  });

  it('no cita Wikipedia', () => {
    for (const topic of data.topics) {
      for (const evidence of topic.evidence) {
        expect(evidence.sourceUrl).not.toContain('wikipedia.org');
        expect(evidence.sourceName.toLowerCase()).not.toContain('wikipedia');
      }
    }
  });
});

describe('data/parties.json', () => {
  it('contiene los 11 partidos esperados', () => {
    const ids = data.parties.map((party) => party.id).sort();
    expect(ids).toEqual(EXPECTED_PARTY_IDS);
  });

  it('declara communities existentes en los partidos territoriales', () => {
    const territoryIds = new Set(data.territories.map((territory) => territory.id));
    for (const party of data.parties) {
      if (party.scope === 'territorial') {
        expect(party.communities?.length ?? 0).toBeGreaterThan(0);
        for (const community of party.communities ?? []) {
          expect(territoryIds.has(community)).toBe(true);
        }
      } else {
        expect(party.communities).toBeUndefined();
      }
    }
  });
});

describe('data/questions.json', () => {
  it('contiene exactamente 25 preguntas, una por tema', () => {
    expect(data.questions).toHaveLength(25);
    expect(data.questions.map((question) => question.topicId).sort()).toEqual(
      data.topics.map((topic) => topic.id).sort(),
    );
  });

  it('usa ids únicos y referencias a temas existentes', () => {
    const ids = data.questions.map((question) => question.id);
    expect(new Set(ids).size).toBe(ids.length);
    const topicIds = new Set(data.topics.map((topic) => topic.id));
    for (const question of data.questions) {
      expect(topicIds.has(question.topicId)).toBe(true);
    }
  });

  it('cumple los umbrales de tipo (≥5 single y ≥5 multi)', () => {
    expect(data.questions.filter((question) => question.type === 'single').length).toBeGreaterThanOrEqual(5);
    expect(data.questions.filter((question) => question.type === 'multi').length).toBeGreaterThanOrEqual(5);
  });
});

describe('data/positions/', () => {
  it('incluye un fichero por partido', () => {
    expect(Object.keys(data.positions).sort()).toEqual(EXPECTED_PARTY_IDS);
  });

  it('completa la matriz 11x25 (una fila por partido y tema)', () => {
    const topicIds = data.topics.map((topic) => topic.id).sort();
    for (const rows of Object.values(data.positions)) {
      expect(rows).toHaveLength(25);
      expect(rows.map((row) => row.topicId).sort()).toEqual(topicIds);
    }
  });

  it('mantiene la coherencia estado/valor/sourceType en toda la matriz', () => {
    for (const rows of Object.values(data.positions)) {
      for (const row of rows) {
        if (row.value === null) {
          expect(row.status).toBe('sin-datos-suficientes');
          expect(row.sourceType).toBe('sin-datos');
          continue;
        }
        expect(row.value).toBeGreaterThanOrEqual(-1);
        expect(row.value).toBeLessThanOrEqual(1);
        expect(row.status).not.toBe('sin-datos-suficientes');
        expect(row.sourceType).not.toBe('sin-datos');
        const recent = row.sourceType === 'programa-2026' || row.sourceDate >= '2026-01-01';
        expect(row.status).toBe(recent ? 'verificado' : 'provisional');
      }
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
    const ercInAndalucia = getApplicableParties(data, 'andalucia').find(
      (party) => party.id === 'erc',
    );
    expect(ercInAndalucia).toBeUndefined();
  });

  it('devuelve los partidos en orden alfabético por nombre', () => {
    const names = getApplicableParties(data, 'cataluna').map((party) => party.displayName);
    const sorted = [...names].sort((a, b) => a.localeCompare(b, 'es'));
    expect(names).toEqual(sorted);
  });
});
