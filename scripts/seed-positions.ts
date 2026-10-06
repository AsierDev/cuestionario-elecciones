import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { partiesFileSchema, questionsFileSchema, type Position } from '../src/data/schema';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (relativePath: string): unknown =>
  JSON.parse(readFileSync(join(root, relativePath), 'utf8'));

const parties = partiesFileSchema.parse(readJson('data/parties.json'));
const questions = questionsFileSchema.parse(readJson('data/questions.json'));

const seedDate = new Date().toISOString().slice(0, 10);
const positionsDir = join(root, 'data/positions');
mkdirSync(positionsDir, { recursive: true });

for (const party of parties) {
  const filePath = join(positionsDir, `${party.id}.json`);
  const existing: Position[] = existsSync(filePath)
    ? (readJson(`data/positions/${party.id}.json`) as Position[])
    : [];
  const byQuestion = new Map(existing.map((row) => [row.questionId, row]));
  const rows = questions.map(
    (question): Position =>
      byQuestion.get(question.id) ?? {
        questionId: question.id,
        value: null,
        status: 'sin-datos-suficientes',
        sourceType: 'sin-datos',
        sourceUrl: party.websiteUrl,
        sourceDate: seedDate,
      },
  );
  writeFileSync(filePath, `${JSON.stringify(rows, null, 2)}\n`);
}

console.log(
  `Sembrados ${parties.length} ficheros de posiciones (${parties.length * questions.length} filas) en data/positions/.`,
);
