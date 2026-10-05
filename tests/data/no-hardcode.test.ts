import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { loadData } from '../../src/data/load';

const data = loadData();

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const srcDir = join(root, 'src');

function listSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? listSourceFiles(path) : [path];
  });
}

function quotedLiteralPattern(id: string): RegExp {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`['"\`]${escaped}['"\`]`);
}

const CONTENT_IDS = [
  ...data.parties.map((party) => party.id),
  ...data.topics.map((topic) => topic.id),
];

describe('no-hardcode: src/ no contiene ids de contenido', () => {
  it('encuentra ficheros de src/ que analizar', () => {
    expect(listSourceFiles(srcDir).length).toBeGreaterThan(0);
  });

  it('no incluye ningún id de partido o tema como literal', () => {
    const files = listSourceFiles(srcDir);
    for (const id of CONTENT_IDS) {
      const pattern = quotedLiteralPattern(id);
      for (const file of files) {
        const content = readFileSync(file, 'utf8');
        expect(content).not.toMatch(pattern);
      }
    }
  });
});
