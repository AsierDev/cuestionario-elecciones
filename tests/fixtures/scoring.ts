import type {
  DataBundle,
  Party,
  PartyScope,
  Position,
  PositionStatus,
  Question,
  SourceType,
  Territory,
  Topic,
} from '../../src/data/schema';

export function territory(id: string): Territory {
  return { id, name: `Territorio ${id}` };
}

export function party(
  id: string,
  options: { displayName?: string; scope?: PartyScope; communities?: string[] } = {},
): Party {
  const scope = options.scope ?? 'estatal';
  return {
    id,
    displayName: options.displayName ?? id.toUpperCase(),
    scope,
    ...(scope === 'territorial' ? { communities: options.communities ?? [] } : {}),
    websiteUrl: `https://example.com/${id}`,
    programUrl: `https://example.com/${id}/programa`,
    programYear: 2026,
  };
}

export function topic(id: string): Topic {
  return {
    id,
    name: `Tema ${id}`,
    description: `Descripción del tema ${id}`,
    evidence: [
      {
        type: 'agenda',
        sourceName: 'Agenda',
        sourceUrl: 'https://example.com/agenda',
        sourceDate: '2026-01-01',
      },
    ],
  };
}

export function question(id: string, topicId: string): Question {
  return {
    id,
    topicId,
    title: `Título ${id}`,
    statement: `Propuesta ${id}`,
    summary: `Resumen ${id}`,
    context: `Contexto ${id}`,
    change: `Cambio ${id}`,
    ifFavor: `A favor ${id}`,
    ifAgainst: `En contra ${id}`,
    glossary: [],
  };
}

export function position(
  questionId: string,
  value: number | null,
  options: {
    status?: PositionStatus;
    sourceType?: SourceType;
    sourceDate?: string;
    note?: string;
  } = {},
): Position {
  if (value === null) {
    return {
      questionId,
      value: null,
      status: 'sin-datos-suficientes',
      sourceType: 'sin-datos',
      sourceUrl: 'https://example.com/sin-datos',
      sourceDate: options.sourceDate ?? '2026-09-01',
    };
  }

  const status = options.status ?? 'verificado';
  const sourceType =
    options.sourceType ?? (status === 'provisional' ? 'programa-2023' : 'programa-2026');
  const sourceDate = options.sourceDate ?? (status === 'provisional' ? '2023-06-01' : '2026-06-01');

  return {
    questionId,
    value,
    status,
    sourceType,
    sourceUrl: 'https://example.com/fuente',
    sourceDate,
    ...(options.note ? { note: options.note } : {}),
  };
}

export function makeBundle(parts: {
  territories?: Territory[];
  parties: Party[];
  topics: Topic[];
  questions: Question[];
  positions?: Record<string, Position[]>;
}): DataBundle {
  return {
    meta: { updatedAt: '2026-10-05', dataVersion: 'test' },
    territories: parts.territories ?? [territory('t1')],
    parties: parts.parties,
    topics: parts.topics,
    questions: parts.questions,
    positions: parts.positions ?? {},
  };
}

export function manyQuestions(
  count: number,
  topicCount = 1,
): { topics: Topic[]; questions: Question[] } {
  const topics = Array.from({ length: topicCount }, (_, index) => topic(`tema-${index + 1}`));
  const questions = Array.from({ length: count }, (_, index) =>
    question(`q${index + 1}`, topics[index % topicCount]?.id ?? 'tema-1'),
  );
  return { topics, questions };
}
