import { z } from 'zod';

export const ID_PATTERN = /^[a-z0-9-]+$/;

const idSchema = z.string().regex(ID_PATTERN, 'debe usar minúsculas, dígitos y guiones');
const urlSchema = z.url('debe ser una URL válida');
const isoDateSchema = z.iso.date();

export const territorySchema = z.object({
  id: idSchema,
  name: z.string().min(1),
});

export const partyScopeSchema = z.enum(['estatal', 'territorial']);

export const partySchema = z
  .object({
    id: idSchema,
    displayName: z.string().min(1),
    scope: partyScopeSchema,
    communities: z.array(idSchema).min(1).optional(),
    websiteUrl: urlSchema,
    programUrl: urlSchema,
    programYear: z.number().int(),
    identityNote: z.string().min(1).optional(),
  })
  .superRefine((party, ctx) => {
    if (party.scope === 'territorial' && !party.communities) {
      ctx.addIssue({
        code: 'custom',
        path: ['communities'],
        message: 'communities es obligatorio para partidos territoriales',
      });
    }
  });

export const evidenceTypeSchema = z.enum(['cis-ranking', 'cis-survey', 'agenda']);

export const topicEvidenceSchema = z
  .object({
    type: evidenceTypeSchema,
    sourceName: z.string().min(1),
    sourceUrl: urlSchema,
    sourceDate: isoDateSchema,
    metric: z.string().min(1).optional(),
    value: z.number().optional(),
  })
  .superRefine((evidence, ctx) => {
    const isCis = evidence.type === 'cis-ranking' || evidence.type === 'cis-survey';
    if (isCis && evidence.value === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['value'],
        message: 'la evidencia CIS requiere un valor numérico',
      });
    }
  });

export const topicSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  description: z.string().min(1),
  evidence: z.array(topicEvidenceSchema).min(1),
});

export const glossaryEntrySchema = z.object({
  term: z.string().min(1),
  definition: z.string().min(1),
});

export const questionSchema = z.object({
  id: idSchema,
  topicId: idSchema,
  title: z.string().min(1),
  statement: z.string().min(1),
  summary: z.string().min(1),
  context: z.string().min(1),
  change: z.string().min(1),
  ifFavor: z.string().min(1),
  ifAgainst: z.string().min(1),
  glossary: z.array(glossaryEntrySchema).default([]),
});

export const positionStatusSchema = z.enum(['verificado', 'provisional', 'sin-datos-suficientes']);

export const sourceTypeSchema = z.enum([
  'programa-2026',
  'programa-2023',
  'declaracion',
  'votacion',
  'sin-datos',
]);

export const positionSchema = z
  .object({
    questionId: idSchema,
    value: z.number().min(-1).max(1).nullable(),
    status: positionStatusSchema,
    sourceType: sourceTypeSchema,
    sourceUrl: urlSchema,
    sourceDate: isoDateSchema,
    note: z.string().min(1).optional(),
  })
  .superRefine((position, ctx) => {
    if (position.value === null) {
      if (position.status !== 'sin-datos-suficientes') {
        ctx.addIssue({
          code: 'custom',
          path: ['status'],
          message: 'value null exige status "sin-datos-suficientes"',
        });
      }
      if (position.sourceType !== 'sin-datos') {
        ctx.addIssue({
          code: 'custom',
          path: ['sourceType'],
          message: 'value null exige sourceType "sin-datos"',
        });
      }
      return;
    }

    if (position.status === 'sin-datos-suficientes') {
      ctx.addIssue({
        code: 'custom',
        path: ['status'],
        message: 'con value no nulo, status no puede ser "sin-datos-suficientes"',
      });
    }
    if (position.sourceType === 'sin-datos') {
      ctx.addIssue({
        code: 'custom',
        path: ['sourceType'],
        message: 'con value no nulo, sourceType no puede ser "sin-datos"',
      });
    }

    const recent = position.sourceType === 'programa-2026' || position.sourceDate >= '2026-01-01';
    const expected = recent ? 'verificado' : 'provisional';
    if (position.status !== expected) {
      ctx.addIssue({
        code: 'custom',
        path: ['status'],
        message: `estado incompatible: con value no nulo se espera "${expected}"`,
      });
    }
  });

export const metaSchema = z.object({
  updatedAt: isoDateSchema,
  dataVersion: z.string().min(1),
  notes: z.string().optional(),
});

export const territoriesFileSchema = z.array(territorySchema);
export const partiesFileSchema = z.array(partySchema);
export const topicsFileSchema = z.array(topicSchema);
export const questionsFileSchema = z.array(questionSchema);
export const positionsFileSchema = z.array(positionSchema);

export type Territory = z.infer<typeof territorySchema>;
export type Party = z.infer<typeof partySchema>;
export type PartyScope = z.infer<typeof partyScopeSchema>;
export type EvidenceType = z.infer<typeof evidenceTypeSchema>;
export type TopicEvidence = z.infer<typeof topicEvidenceSchema>;
export type Topic = z.infer<typeof topicSchema>;
export type GlossaryEntry = z.infer<typeof glossaryEntrySchema>;
export type Question = z.infer<typeof questionSchema>;
export type PositionStatus = z.infer<typeof positionStatusSchema>;
export type SourceType = z.infer<typeof sourceTypeSchema>;
export type Position = z.infer<typeof positionSchema>;
export type Meta = z.infer<typeof metaSchema>;

export interface DataBundle {
  meta: Meta;
  territories: Territory[];
  parties: Party[];
  topics: Topic[];
  questions: Question[];
  positions: Record<string, Position[]>;
}

export function formatZodIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join('.') : '(raíz)';
    return `${path}: ${issue.message}`;
  });
}

function collectDuplicates(issues: string[], label: string, ids: string[]): void {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) duplicates.add(id);
    seen.add(id);
  }
  for (const id of duplicates) issues.push(`${label} duplicado: "${id}"`);
}

export function validateDataReferences(data: DataBundle): string[] {
  const issues: string[] = [];

  collectDuplicates(
    issues,
    'territorio',
    data.territories.map((territory) => territory.id),
  );
  collectDuplicates(
    issues,
    'partido',
    data.parties.map((party) => party.id),
  );
  collectDuplicates(
    issues,
    'tema',
    data.topics.map((topic) => topic.id),
  );
  collectDuplicates(
    issues,
    'pregunta',
    data.questions.map((question) => question.id),
  );

  const territoryIds = new Set(data.territories.map((territory) => territory.id));
  const partyIds = new Set(data.parties.map((party) => party.id));
  const topicIds = new Set(data.topics.map((topic) => topic.id));
  const questionIds = new Set(data.questions.map((question) => question.id));

  for (const party of data.parties) {
    for (const community of party.communities ?? []) {
      if (!territoryIds.has(community)) {
        issues.push(
          `partido "${party.id}": la comunidad "${community}" no existe en data/territories.json`,
        );
      }
    }
  }

  for (const question of data.questions) {
    if (!topicIds.has(question.topicId)) {
      issues.push(
        `pregunta "${question.id}": el topicId "${question.topicId}" no existe en data/topics.json`,
      );
    }
  }

  const positionPartyIds = new Set(Object.keys(data.positions));
  for (const party of data.parties) {
    if (!positionPartyIds.has(party.id)) {
      issues.push(`falta el fichero data/positions/${party.id}.json`);
    }
  }
  for (const partyId of positionPartyIds) {
    if (!partyIds.has(partyId)) {
      issues.push(`data/positions/${partyId}.json no corresponde a ningún partido`);
    }
  }

  for (const topic of data.topics) {
    if (!data.questions.some((question) => question.topicId === topic.id)) {
      issues.push(`tema "${topic.id}": no tiene ninguna pregunta en data/questions.json`);
    }
  }

  for (const [partyId, rows] of Object.entries(data.positions)) {
    const seenQuestions = new Set<string>();
    for (const row of rows) {
      if (!questionIds.has(row.questionId)) {
        issues.push(`data/positions/${partyId}.json: la pregunta "${row.questionId}" no existe`);
      }
      if (seenQuestions.has(row.questionId)) {
        issues.push(
          `data/positions/${partyId}.json: la pregunta "${row.questionId}" aparece más de una vez`,
        );
      }
      seenQuestions.add(row.questionId);
    }
    for (const question of data.questions) {
      if (!seenQuestions.has(question.id)) {
        issues.push(`data/positions/${partyId}.json: falta la pregunta "${question.id}"`);
      }
    }
  }

  return issues;
}
