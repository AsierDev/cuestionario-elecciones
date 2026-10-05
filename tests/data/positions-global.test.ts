import { describe, expect, it } from 'vitest';

import { loadData } from '../../src/data/load';

const data = loadData();

const ALL_PARTY_IDS = [
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

const TERRITORIAL_PARTY_IDS = ['erc', 'junts', 'pnv', 'eh-bildu', 'bng', 'coalicion-canaria'];

const GLOBAL_COVERAGE_MIN = 0.7;
const PARTY_COVERAGE_MIN = 0.5;
const NOTE_MAX_LENGTH = 240;

describe('posiciones de los partidos territoriales y cobertura global', () => {
  it('carga sin errores de contrato (esquema zod + referencias cruzadas)', () => {
    expect(Object.keys(data.positions).sort()).toEqual(ALL_PARTY_IDS);
  });

  it('completa la matriz de 25 filas por partido territorial', () => {
    const topicIds = data.topics.map((topic) => topic.id).sort();
    for (const partyId of TERRITORIAL_PARTY_IDS) {
      const rows = data.positions[partyId];
      expect(rows).toHaveLength(25);
      expect(rows.map((row) => row.topicId).sort()).toEqual(topicIds);
    }
  });

  it('respeta la coherencia estado/sourceType/sourceDate en cada fila', () => {
    for (const partyId of ALL_PARTY_IDS) {
      for (const row of data.positions[partyId]) {
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

  it('deja las búsquedas negativas como sin-datos-suficientes aunque la consulta sea de 2026', () => {
    const negativeSearches = ALL_PARTY_IDS.flatMap((partyId) =>
      data.positions[partyId].filter((row) => row.value === null),
    );
    expect(negativeSearches.length).toBeGreaterThan(0);
    for (const row of negativeSearches) {
      expect(row.status).toBe('sin-datos-suficientes');
      expect(row.sourceType).toBe('sin-datos');
      expect(row.sourceDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('no marca ninguna fila sin datos con valor no nulo', () => {
    for (const partyId of ALL_PARTY_IDS) {
      for (const row of data.positions[partyId]) {
        if (row.status === 'sin-datos-suficientes') {
          expect(row.value).toBeNull();
          expect(row.sourceType).toBe('sin-datos');
        }
      }
    }
  });

  it(`alcanza una cobertura global ≥${GLOBAL_COVERAGE_MIN * 100}%`, () => {
    const cells = ALL_PARTY_IDS.flatMap((partyId) => data.positions[partyId]);
    const withData = cells.filter((row) => row.value !== null).length;
    expect(withData / cells.length).toBeGreaterThanOrEqual(GLOBAL_COVERAGE_MIN);
  });

  it(`alcanza una cobertura ≥${PARTY_COVERAGE_MIN * 100}% en cada partido`, () => {
    for (const partyId of ALL_PARTY_IDS) {
      const rows = data.positions[partyId];
      const withData = rows.filter((row) => row.value !== null).length;
      expect(withData / rows.length).toBeGreaterThanOrEqual(PARTY_COVERAGE_MIN);
    }
  });

  it('mantiene las notas breves (≤240 caracteres)', () => {
    for (const partyId of ALL_PARTY_IDS) {
      for (const row of data.positions[partyId]) {
        if (row.note) expect(row.note.length).toBeLessThanOrEqual(NOTE_MAX_LENGTH);
      }
    }
  });
});
