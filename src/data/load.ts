import { z } from 'zod';

import metaJson from '../../data/meta.json';
import partiesJson from '../../data/parties.json';
import questionsJson from '../../data/questions.json';
import territoriesJson from '../../data/territories.json';
import topicsJson from '../../data/topics.json';

import {
  formatZodIssues,
  metaSchema,
  partiesFileSchema,
  positionsFileSchema,
  questionsFileSchema,
  territoriesFileSchema,
  topicsFileSchema,
  validateDataReferences,
  type DataBundle,
  type Party,
  type Position,
} from './schema';

export type { DataBundle, Party, Position } from './schema';

const positionModules = import.meta.glob('../../data/positions/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, unknown>;

function partyIdFromPath(path: string): string {
  const file = path.split('/').pop() ?? '';
  return file.replace(/\.json$/, '');
}

function parseOrThrow<T>(schema: z.ZodType<T>, value: unknown, label: string): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new Error(
      `Contrato de datos inválido en ${label}:\n- ${formatZodIssues(result.error).join('\n- ')}`,
    );
  }
  return result.data;
}

export function loadData(): DataBundle {
  const meta = parseOrThrow(metaSchema, metaJson, 'data/meta.json');
  const territories = parseOrThrow(
    territoriesFileSchema,
    territoriesJson,
    'data/territories.json',
  );
  const parties = parseOrThrow(partiesFileSchema, partiesJson, 'data/parties.json');
  const topics = parseOrThrow(topicsFileSchema, topicsJson, 'data/topics.json');
  const questions = parseOrThrow(questionsFileSchema, questionsJson, 'data/questions.json');

  const positions: Record<string, Position[]> = {};
  for (const [path, raw] of Object.entries(positionModules)) {
    positions[partyIdFromPath(path)] = parseOrThrow(positionsFileSchema, raw, path);
  }

  const data: DataBundle = { meta, territories, parties, topics, questions, positions };
  const issues = validateDataReferences(data);
  if (issues.length > 0) {
    throw new Error(`Contrato de datos inválido:\n- ${issues.join('\n- ')}`);
  }
  return data;
}

export function getApplicableParties(data: DataBundle, territoryId: string): Party[] {
  return data.parties
    .filter(
      (party) =>
        party.scope === 'estatal' || (party.communities?.includes(territoryId) ?? false),
    )
    .sort((a, b) => a.displayName.localeCompare(b.displayName, 'es'));
}
