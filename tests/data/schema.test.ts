import { describe, expect, it } from 'vitest';

import {
  partySchema,
  positionSchema,
  questionSchema,
  topicSchema,
  validateDataReferences,
} from '../../src/data/schema';
import { makeBundle, party, position, question, territory, topic } from '../fixtures/scoring';

describe('positionSchema', () => {
  it('acepta una fila con evidencia de 2026 como verificada', () => {
    expect(positionSchema.safeParse(position('q1', 0.5)).success).toBe(true);
  });

  it('acepta una fila provisional con evidencia anterior a 2026', () => {
    expect(positionSchema.safeParse(position('q1', -1, { status: 'provisional' })).success).toBe(
      true,
    );
  });

  it('acepta programa-2026 como verificado aunque la fecha sea anterior', () => {
    const row = position('q1', 1, { sourceType: 'programa-2026', sourceDate: '2025-12-01' });
    expect(positionSchema.safeParse(row).success).toBe(true);
  });

  it('acepta una búsqueda negativa de 2026 como sin-datos-suficientes', () => {
    expect(positionSchema.safeParse(position('q1', null, { sourceDate: '2026-10-06' })).success).toBe(
      true,
    );
  });

  it('rechaza un value fuera de rango', () => {
    expect(positionSchema.safeParse({ ...position('q1', 1), value: 1.5 }).success).toBe(false);
  });

  it('rechaza value nulo con status verificado', () => {
    expect(positionSchema.safeParse({ ...position('q1', null), status: 'verificado' }).success).toBe(
      false,
    );
  });

  it('rechaza estado verificado con evidencia anterior a 2026', () => {
    const row = { ...position('q1', 1, { status: 'provisional' }), status: 'verificado' };
    expect(positionSchema.safeParse(row).success).toBe(false);
  });

  it('rechaza estado provisional con evidencia de 2026', () => {
    const row = { ...position('q1', 1), status: 'provisional' };
    expect(positionSchema.safeParse(row).success).toBe(false);
  });

  it('rechaza una fila sin questionId', () => {
    const row: Record<string, unknown> = { ...position('q1', 1) };
    delete row.questionId;
    expect(positionSchema.safeParse(row).success).toBe(false);
  });

  it('rechaza una sourceUrl que no es URL', () => {
    expect(positionSchema.safeParse({ ...position('q1', 1), sourceUrl: 'fuente' }).success).toBe(
      false,
    );
  });
});

describe('topicSchema', () => {
  it('acepta un tema con descripción y evidencia', () => {
    expect(topicSchema.safeParse(topic('vivienda')).success).toBe(true);
  });

  it('rechaza un tema sin descripción', () => {
    const value: Record<string, unknown> = { ...topic('vivienda') };
    delete value.description;
    expect(topicSchema.safeParse(value).success).toBe(false);
  });

  it('rechaza evidencia CIS sin valor numérico', () => {
    const value = {
      ...topic('vivienda'),
      evidence: [
        {
          type: 'cis-ranking',
          sourceName: 'CIS',
          sourceUrl: 'https://www.cis.es/',
          sourceDate: '2026-09-01',
        },
      ],
    };
    expect(topicSchema.safeParse(value).success).toBe(false);
  });
});

describe('questionSchema', () => {
  it('acepta una propuesta con todos los campos explicativos', () => {
    expect(questionSchema.safeParse(question('q1', 'tema')).success).toBe(true);
  });

  it('completa el glosario vacío si no se indica', () => {
    const value: Record<string, unknown> = { ...question('q1', 'tema') };
    delete value.glossary;
    const parsed = questionSchema.parse(value);
    expect(parsed.glossary).toEqual([]);
  });

  it.each(['statement', 'context', 'change', 'ifFavor', 'ifAgainst'] as const)(
    'rechaza una propuesta sin %s',
    (field) => {
      const value: Record<string, unknown> = { ...question('q1', 'tema') };
      delete value[field];
      expect(questionSchema.safeParse(value).success).toBe(false);
    },
  );
});

describe('partySchema', () => {
  it('rechaza un partido territorial sin communities', () => {
    const value = { ...party('x', { scope: 'territorial', communities: ['t1'] }) };
    delete (value as { communities?: string[] }).communities;
    expect(partySchema.safeParse(value).success).toBe(false);
  });
});

describe('validateDataReferences', () => {
  const base = () =>
    makeBundle({
      parties: [party('a')],
      topics: [topic('tema')],
      questions: [question('q1', 'tema'), question('q2', 'tema')],
      positions: { a: [position('q1', 1), position('q2', null)] },
    });

  it('acepta un bundle coherente', () => {
    expect(validateDataReferences(base())).toEqual([]);
  });

  it('detecta una pregunta desconocida en las posiciones', () => {
    const data = base();
    data.positions.a = [...(data.positions.a ?? []), position('q9', 1)];
    expect(validateDataReferences(data).join('\n')).toContain('"q9" no existe');
  });

  it('detecta una pregunta ausente en la matriz de un partido', () => {
    const data = base();
    data.positions.a = [position('q1', 1)];
    expect(validateDataReferences(data).join('\n')).toContain('falta la pregunta "q2"');
  });

  it('detecta un tema sin preguntas', () => {
    const data = base();
    data.topics.push(topic('vacio'));
    expect(validateDataReferences(data).join('\n')).toContain('tema "vacio"');
  });

  it('detecta un fichero de posiciones que falta y una comunidad inexistente', () => {
    const data = makeBundle({
      territories: [territory('t1')],
      parties: [party('a'), party('b', { scope: 'territorial', communities: ['t9'] })],
      topics: [topic('tema')],
      questions: [question('q1', 'tema')],
      positions: { a: [position('q1', 1)] },
    });
    const issues = validateDataReferences(data).join('\n');
    expect(issues).toContain('falta el fichero data/positions/b.json');
    expect(issues).toContain('"t9" no existe');
  });
});
