import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { partiesFileSchema, topicsFileSchema, type Position } from '../src/data/schema';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (relativePath: string): unknown =>
  JSON.parse(readFileSync(join(root, relativePath), 'utf8'));

const parties = partiesFileSchema.parse(readJson('data/parties.json'));
const topics = topicsFileSchema.parse(readJson('data/topics.json'));

const seedDate = new Date().toISOString().slice(0, 10);
const positionsDir = join(root, 'data/positions');
mkdirSync(positionsDir, { recursive: true });

for (const party of parties) {
  const filePath = join(positionsDir, `${party.id}.json`);
  const existing: Position[] = existsSync(filePath)
    ? (readJson(`data/positions/${party.id}.json`) as Position[])
    : [];
  const byTopic = new Map(existing.map((row) => [row.topicId, row]));
  const rows = topics.map(
    (topic): Position =>
      byTopic.get(topic.id) ?? {
        topicId: topic.id,
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
  `Sembrados ${parties.length} ficheros de posiciones (${parties.length * topics.length} filas) en data/positions/.`,
);
