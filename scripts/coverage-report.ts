import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { partiesFileSchema, positionsFileSchema, topicsFileSchema } from '../src/data/schema';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (relativePath: string): unknown =>
  JSON.parse(readFileSync(join(root, relativePath), 'utf8'));

const parties = partiesFileSchema.parse(readJson('data/parties.json'));
const topics = topicsFileSchema.parse(readJson('data/topics.json'));

interface CoverageRow {
  label: string;
  withData: number;
  withoutData: number;
  percentage: number;
}

const rows: CoverageRow[] = [];
let totalWithData = 0;
let totalCells = 0;

for (const party of parties) {
  const relativePath = `data/positions/${party.id}.json`;
  const filePath = join(root, relativePath);
  const positions = existsSync(filePath) ? positionsFileSchema.parse(readJson(relativePath)) : [];
  const withData = positions.filter((position) => position.value !== null).length;
  const withoutData = positions.filter((position) => position.value === null).length;
  totalWithData += withData;
  totalCells += positions.length;
  rows.push({
    label: party.displayName,
    withData,
    withoutData,
    percentage: positions.length > 0 ? (withData / positions.length) * 100 : 0,
  });
}

const globalPercentage = totalCells > 0 ? (totalWithData / totalCells) * 100 : 0;

const labelWidth = Math.max(7, ...rows.map((row) => row.label.length));
const line = (label: string, withData: number, withoutData: number, percentage: number): string =>
  `${label.padEnd(labelWidth)}  ${String(withData).padStart(8)}  ${String(withoutData).padStart(9)}  ${`${percentage.toFixed(1)}%`.padStart(9)}`;

console.log(`Cobertura de posiciones (${topics.length} temas por partido)`);
console.log(
  `${'Partido'.padEnd(labelWidth)}  ${'Con dato'.padStart(8)}  ${'Sin datos'.padStart(9)}  ${'Cobertura'.padStart(9)}`,
);
for (const row of rows) {
  console.log(line(row.label, row.withData, row.withoutData, row.percentage));
}
console.log(line('Global', totalWithData, totalCells - totalWithData, globalPercentage));
