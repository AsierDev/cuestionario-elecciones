import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REFERENCE_PATTERN = /(?:href|src)\s*=\s*"([^"]*)"/g;

const EXTERNAL_PREFIXES = ['http://', 'https://', '//', 'data:', 'mailto:'];

/**
 * Comprueba que el HTML construido es desplegable como *project site* de GitHub
 * Pages: ninguna referencia `href`/`src` puede ser absoluta desde la raíz y los
 * assets locales deben existir con ruta relativa (`./...`).
 */
export function checkDistHtml(
  html: string,
  fileExists: (reference: string) => boolean,
): string[] {
  const issues: string[] = [];

  for (const match of html.matchAll(REFERENCE_PATTERN)) {
    const reference = match[1].trim();
    if (reference === '' || reference.startsWith('#')) continue;
    if (EXTERNAL_PREFIXES.some((prefix) => reference.startsWith(prefix))) continue;

    if (reference.startsWith('/')) {
      issues.push(`referencia absoluta no válida para project site: "${reference}"`);
      continue;
    }

    if (!reference.startsWith('./')) {
      issues.push(`la referencia local debe ser relativa ("./..."): "${reference}"`);
      continue;
    }

    if (!fileExists(reference)) {
      issues.push(`la referencia no existe en dist/: "${reference}"`);
    }
  }

  return issues;
}

function main(): void {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const distDir = join(root, 'dist');
  const indexPath = join(distDir, 'index.html');

  if (!existsSync(indexPath)) {
    console.error(
      '✗ No se encontró dist/index.html. Ejecuta "npm run build" antes de "npm run check:dist".',
    );
    process.exit(1);
  }

  const html = readFileSync(indexPath, 'utf8');
  const issues = checkDistHtml(html, (reference) => existsSync(resolve(distDir, reference)));

  if (issues.length > 0) {
    console.error(
      `✗ dist/index.html no es desplegable en un project site (${issues.length} problema(s)):`,
    );
    for (const issue of issues) {
      console.error(`  - ${issue}`);
    }
    process.exit(1);
  }

  console.log(
    '✓ dist/index.html usa rutas relativas y sus assets existen: apto para GitHub Pages (project site).',
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
