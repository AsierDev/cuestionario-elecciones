import { describe, expect, it } from 'vitest';

import {
  partySchema,
  positionSchema,
  questionSchema,
  topicSchema,
  validateDataReferences,
  type DataBundle,
  type Party,
  type Position,
  type Question,
  type Territory,
  type Topic,
  type TopicEvidence,
} from '../../src/data/schema';

const validCisEvidence: TopicEvidence = {
  type: 'cis-ranking',
  sourceName: 'CIS, Estudio 3577',
  sourceUrl: 'https://www.cis.es/estudio-3577',
  sourceDate: '2026-09-01',
  metric: 'Q-NAC',
  value: 37.5,
};

const validPosition: Position = {
  topicId: 'vivienda',
  value: 0.5,
  status: 'verificado',
  sourceType: 'programa-2026',
  sourceUrl: 'https://example.com/programa.pdf',
  sourceDate: '2026-06-01',
};

const validTopic: Topic = {
  id: 'vivienda',
  name: 'Vivienda y alquiler',
  block: 'A',
  evidence: [validCisEvidence],
};

const validParty: Party = {
  id: 'psoe',
  displayName: 'PSOE',
  scope: 'estatal',
  websiteUrl: 'https://www.psoe.es/',
  programUrl: 'https://www.psoe.es/programa.pdf',
  programYear: 2023,
};

const validQuestion: Question = {
  id: 'vivienda-pregunta',
  topicId: 'vivienda',
  text: '¿Qué prioridad debe tener la vivienda?',
  type: 'single',
  options: [
    { id: 'op-0', label: 'Baja', value: -1 },
    { id: 'op-1', label: 'Media', value: 0 },
    { id: 'op-2', label: 'Alta', value: 1 },
  ],
};

const territory: Territory = { id: 'cataluna', name: 'Cataluña' };

const seedPosition: Position = {
  topicId: 'vivienda',
  value: null,
  status: 'sin-datos-suficientes',
  sourceType: 'sin-datos',
  sourceUrl: 'https://www.psoe.es/',
  sourceDate: '2026-10-05',
};

function makeBundle(overrides: Partial<DataBundle> = {}): DataBundle {
  return {
    meta: { updatedAt: '2026-10-05', dataVersion: '0.1.0' },
    territories: [territory],
    parties: [validParty],
    topics: [validTopic],
    questions: [],
    positions: { psoe: [seedPosition] },
    ...overrides,
  };
}

describe('positionSchema', () => {
  it('acepta una fila con dato y evidencia de 2026 como verificada', () => {
    expect(positionSchema.safeParse(validPosition).success).toBe(true);
  });

  it('acepta una fila provisional con evidencia anterior a 2026', () => {
    const result = positionSchema.safeParse({
      ...validPosition,
      status: 'provisional',
      sourceType: 'programa-2023',
      sourceDate: '2023-07-01',
    });
    expect(result.success).toBe(true);
  });

  it('acepta programa-2026 como verificado aunque la fecha sea anterior', () => {
    const result = positionSchema.safeParse({
      ...validPosition,
      sourceType: 'programa-2026',
      sourceDate: '2025-01-01',
    });
    expect(result.success).toBe(true);
  });

  it('acepta una búsqueda negativa de 2026 como sin-datos-suficientes', () => {
    const result = positionSchema.safeParse({
      topicId: 'vivienda',
      value: null,
      status: 'sin-datos-suficientes',
      sourceType: 'sin-datos',
      sourceUrl: 'https://www.psoe.es/',
      sourceDate: '2026-10-05',
    });
    expect(result.success).toBe(true);
  });

  it('rechaza una fila sin sourceUrl', () => {
    const withoutSourceUrl = {
      topicId: 'vivienda',
      value: 0.5,
      status: 'verificado',
      sourceType: 'programa-2026',
      sourceDate: '2026-06-01',
    };
    expect(positionSchema.safeParse(withoutSourceUrl).success).toBe(false);
  });

  it('rechaza una fila sin status', () => {
    const withoutStatus = {
      topicId: 'vivienda',
      value: 0.5,
      sourceType: 'programa-2026',
      sourceUrl: 'https://example.com/programa.pdf',
      sourceDate: '2026-06-01',
    };
    expect(positionSchema.safeParse(withoutStatus).success).toBe(false);
  });

  it('rechaza un value fuera de rango', () => {
    expect(positionSchema.safeParse({ ...validPosition, value: 1.5 }).success).toBe(false);
    expect(positionSchema.safeParse({ ...validPosition, value: -2 }).success).toBe(false);
  });

  it('rechaza value nulo con status verificado', () => {
    expect(positionSchema.safeParse({ ...validPosition, value: null }).success).toBe(false);
  });

  it('rechaza value no nulo con status sin-datos-suficientes', () => {
    const result = positionSchema.safeParse({
      ...validPosition,
      status: 'sin-datos-suficientes',
      sourceType: 'sin-datos',
    });
    expect(result.success).toBe(false);
  });

  it('rechaza estado verificado con evidencia anterior a 2026', () => {
    const result = positionSchema.safeParse({
      ...validPosition,
      sourceType: 'programa-2023',
      sourceDate: '2023-07-01',
    });
    expect(result.success).toBe(false);
  });

  it('rechaza estado provisional con evidencia de 2026', () => {
    expect(positionSchema.safeParse({ ...validPosition, status: 'provisional' }).success).toBe(
      false,
    );
  });

  it('rechaza una sourceDate que no es ISO YYYY-MM-DD', () => {
    expect(positionSchema.safeParse({ ...validPosition, sourceDate: '2026-6-1' }).success).toBe(
      false,
    );
    expect(positionSchema.safeParse({ ...validPosition, sourceDate: '2026-02-30' }).success).toBe(
      false,
    );
  });

  it('rechaza una sourceUrl que no es URL', () => {
    expect(positionSchema.safeParse({ ...validPosition, sourceUrl: 'no-es-url' }).success).toBe(
      false,
    );
  });
});

describe('topicSchema', () => {
  it('acepta un tema de bloque A con evidencia CIS', () => {
    expect(topicSchema.safeParse(validTopic).success).toBe(true);
  });

  it('rechaza un tema de bloque A sin evidencia CIS', () => {
    const result = topicSchema.safeParse({
      ...validTopic,
      evidence: [
        {
          type: 'agenda',
          sourceName: 'Comparador RTVE',
          sourceUrl: 'https://www.rtve.es/comparador',
          sourceDate: '2023-07-23',
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('rechaza un tema de bloque B sin evidencia de agenda', () => {
    const result = topicSchema.safeParse({
      ...validTopic,
      block: 'B',
      evidence: [validCisEvidence],
    });
    expect(result.success).toBe(false);
  });

  it('rechaza evidencia CIS sin valor numérico', () => {
    const withoutValue = {
      type: 'cis-ranking',
      sourceName: 'CIS, Estudio 3577',
      sourceUrl: 'https://www.cis.es/estudio-3577',
      sourceDate: '2026-09-01',
      metric: 'Q-NAC',
    };
    const result = topicSchema.safeParse({ ...validTopic, evidence: [withoutValue] });
    expect(result.success).toBe(false);
  });
});

describe('partySchema', () => {
  it('acepta un partido estatal sin communities', () => {
    expect(partySchema.safeParse(validParty).success).toBe(true);
  });

  it('rechaza un partido territorial sin communities', () => {
    expect(partySchema.safeParse({ ...validParty, scope: 'territorial' }).success).toBe(false);
  });

  it('acepta un partido territorial con communities', () => {
    const result = partySchema.safeParse({
      ...validParty,
      scope: 'territorial',
      communities: ['cataluna'],
    });
    expect(result.success).toBe(true);
  });
});

describe('questionSchema', () => {
  it('acepta una pregunta con opciones válidas', () => {
    expect(questionSchema.safeParse(validQuestion).success).toBe(true);
  });

  it('rechaza opciones con valores repetidos', () => {
    const result = questionSchema.safeParse({
      ...validQuestion,
      options: [
        { id: 'op-0', label: 'A', value: 0 },
        { id: 'op-1', label: 'B', value: 0 },
        { id: 'op-2', label: 'C', value: 1 },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('rechaza menos de tres opciones', () => {
    const result = questionSchema.safeParse({
      ...validQuestion,
      options: [
        { id: 'op-0', label: 'A', value: -1 },
        { id: 'op-1', label: 'B', value: 1 },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('rechaza un value de opción fuera de [-1,1]', () => {
    const result = questionSchema.safeParse({
      ...validQuestion,
      options: [
        { id: 'op-0', label: 'A', value: -2 },
        { id: 'op-1', label: 'B', value: 0 },
        { id: 'op-2', label: 'C', value: 1 },
      ],
    });
    expect(result.success).toBe(false);
  });
});

describe('validateDataReferences', () => {
  it('acepta un bundle coherente', () => {
    expect(validateDataReferences(makeBundle())).toEqual([]);
  });

  it('detecta un topicId desconocido en las posiciones', () => {
    const issues = validateDataReferences(
      makeBundle({ positions: { psoe: [{ ...seedPosition, topicId: 'inexistente' }] } }),
    );
    expect(issues.some((issue) => issue.includes('inexistente'))).toBe(true);
  });

  it('detecta un tema ausente en la matriz de un partido', () => {
    const issues = validateDataReferences(makeBundle({ positions: { psoe: [] } }));
    expect(issues.some((issue) => issue.includes('falta el tema "vivienda"'))).toBe(true);
  });

  it('detecta un fichero de posiciones que falta para un partido', () => {
    const issues = validateDataReferences(makeBundle({ positions: {} }));
    expect(issues.some((issue) => issue.includes('falta el fichero'))).toBe(true);
  });

  it('detecta una comunidad inexistente', () => {
    const issues = validateDataReferences(
      makeBundle({
        parties: [{ ...validParty, scope: 'territorial', communities: ['atlantida'] }],
      }),
    );
    expect(issues.some((issue) => issue.includes('atlantida'))).toBe(true);
  });

  it('detecta ids duplicados', () => {
    const issues = validateDataReferences(makeBundle({ territories: [territory, territory] }));
    expect(issues.some((issue) => issue.includes('territorio duplicado'))).toBe(true);
  });
});
