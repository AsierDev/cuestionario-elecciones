import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { z } from 'zod';

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
  type Position,
  type Question,
  type Topic,
} from '../src/data/schema';

const EXPECTED_QUESTIONS = 30;
const MAX_TOPICS = 12;

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (relativePath: string): unknown =>
  JSON.parse(readFileSync(join(root, relativePath), 'utf8'));

const issues: string[] = [];

function parseFile<T>(schema: z.ZodType<T>, relativePath: string): T | undefined {
  const result = schema.safeParse(readJson(relativePath));
  if (!result.success) {
    for (const issue of formatZodIssues(result.error)) {
      issues.push(`${relativePath} → ${issue}`);
    }
    return undefined;
  }
  return result.data;
}

function validateQuestionCoverage(topics: Topic[], questions: Question[]): string[] {
  const issues: string[] = [];
  if (questions.length !== EXPECTED_QUESTIONS) {
    issues.push(
      `data/questions.json: se esperan exactamente ${EXPECTED_QUESTIONS} preguntas, hay ${questions.length}`,
    );
  }
  if (topics.length > MAX_TOPICS) {
    issues.push(`data/topics.json: hay ${topics.length} temas; el máximo es ${MAX_TOPICS}`);
  }
  return issues;
}

const meta = parseFile(metaSchema, 'data/meta.json');
const territories = parseFile(territoriesFileSchema, 'data/territories.json');
const parties = parseFile(partiesFileSchema, 'data/parties.json');
const topics = parseFile(topicsFileSchema, 'data/topics.json');
const questions = parseFile(questionsFileSchema, 'data/questions.json');

const positions: Record<string, Position[]> = {};
const positionsDir = join(root, 'data/positions');
const positionFiles = existsSync(positionsDir)
  ? readdirSync(positionsDir)
      .filter((file) => file.endsWith('.json'))
      .sort()
  : [];

for (const file of positionFiles) {
  const rows = parseFile(positionsFileSchema, `data/positions/${file}`);
  if (rows) positions[file.replace(/\.json$/, '')] = rows;
}

if (meta && territories && parties && topics && questions) {
  const data: DataBundle = { meta, territories, parties, topics, questions, positions };
  issues.push(...validateDataReferences(data));
  issues.push(...validateQuestionCoverage(topics, questions));
}

if (issues.length > 0) {
  console.error(`✗ Contrato de datos inválido (${issues.length} problema(s)):`);
  for (const issue of issues) {
    console.error(`  - ${issue}`);
  }
  process.exit(1);
}

console.log(
  `✓ Contrato de datos válido: ${territories?.length ?? 0} territorios, ${topics?.length ?? 0} temas, ` +
    `${parties?.length ?? 0} partidos, ${questions?.length ?? 0} preguntas, matriz ` +
    `${positionFiles.length}×${questions?.length ?? 0}.`,
);
