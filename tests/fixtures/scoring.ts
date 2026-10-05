import type {
  DataBundle,
  Party,
  PartyScope,
  Position,
  PositionStatus,
  Question,
  QuestionType,
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
    block: 'B',
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

export function question(
  id: string,
  topicId: string,
  options: { type?: QuestionType; values?: number[] } = {},
): Question {
  const values = options.values ?? [-1, 0, 1];
  return {
    id,
    topicId,
    text: `Pregunta ${id}`,
    type: options.type ?? 'single',
    options: values.map((value, index) => ({
      id: `${id}-op${index}`,
      label: `Opción ${index}`,
      value,
    })),
  };
}

export function position(
  topicId: string,
  value: number | null,
  options: { status?: PositionStatus; sourceType?: SourceType; sourceDate?: string } = {},
): Position {
  if (value === null) {
    return {
      topicId,
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
    topicId,
    value,
    status,
    sourceType,
    sourceUrl: 'https://example.com/fuente',
    sourceDate,
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

export function manyQuestions(count: number): { topics: Topic[]; questions: Question[] } {
  const topics = Array.from({ length: count }, (_, index) => topic(`tema-${index + 1}`));
  const questions = topics.map((item, index) => question(`q${index + 1}`, item.id));
  return { topics, questions };
}
