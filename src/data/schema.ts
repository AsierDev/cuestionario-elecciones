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

export const topicBlockSchema = z.enum(['A', 'B']);

export const topicSchema = z
  .object({
    id: idSchema,
    name: z.string().min(1),
    block: topicBlockSchema,
    evidence: z.array(topicEvidenceSchema).min(1),
  })
  .superRefine((topic, ctx) => {
    const hasCis = topic.evidence.some(
      (evidence) => evidence.type === 'cis-ranking' || evidence.type === 'cis-survey',
    );
    const hasAgenda = topic.evidence.some((evidence) => evidence.type === 'agenda');
    if (topic.block === 'A' && !hasCis) {
      ctx.addIssue({
        code: 'custom',
        path: ['evidence'],
        message: 'los temas del bloque A requieren evidencia CIS (cis-ranking o cis-survey)',
      });
    }
    if (topic.block === 'B' && !hasAgenda) {
      ctx.addIssue({
        code: 'custom',
        path: ['evidence'],
        message: 'los temas del bloque B requieren evidencia de agenda',
      });
    }
  });

export const questionTypeSchema = z.enum(['single', 'multi']);

export const questionOptionSchema = z.object({
  id: idSchema,
  label: z.string().min(1),
  value: z.number().min(-1).max(1),
});

export const questionSchema = z
  .object({
    id: idSchema,
    topicId: idSchema,
    text: z.string().min(1),
    type: questionTypeSchema,
    axisNote: z.string().min(1).optional(),
    options: z.array(questionOptionSchema).min(3).max(5),
  })
  .superRefine((question, ctx) => {
    const values = question.options.map((option) => option.value);
    if (new Set(values).size !== values.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['options'],
        message: 'los valores de las opciones deben ser distintos',
      });
    }
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
    topicId: idSchema,
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
export type TopicBlock = z.infer<typeof topicBlockSchema>;
export type Topic = z.infer<typeof topicSchema>;
export type QuestionType = z.infer<typeof questionTypeSchema>;
export type QuestionOption = z.infer<typeof questionOptionSchema>;
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

  for (const [partyId, rows] of Object.entries(data.positions)) {
    const seenTopics = new Set<string>();
    for (const row of rows) {
      if (!topicIds.has(row.topicId)) {
        issues.push(`data/positions/${partyId}.json: el topicId "${row.topicId}" no existe`);
      }
      if (seenTopics.has(row.topicId)) {
        issues.push(
          `data/positions/${partyId}.json: el tema "${row.topicId}" aparece más de una vez`,
        );
      }
      seenTopics.add(row.topicId);
    }
    for (const topic of data.topics) {
      if (!seenTopics.has(topic.id)) {
        issues.push(`data/positions/${partyId}.json: falta el tema "${topic.id}"`);
      }
    }
  }

  return issues;
}
