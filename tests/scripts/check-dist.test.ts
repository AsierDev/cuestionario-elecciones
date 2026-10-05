import { describe, expect, it } from 'vitest';

import { checkDistHtml } from '../../scripts/check-dist';

const alwaysExists = (): boolean => true;
const neverExists = (): boolean => false;

describe('checkDistHtml', () => {
  it('acepta un HTML con assets relativos existentes', () => {
    const html = [
      '<link rel="icon" href="./assets/favicon-abc.svg" />',
      '<script src="./assets/index-abc.js"></script>',
      '<link rel="stylesheet" href="./assets/index-abc.css" />',
    ].join('\n');

    expect(checkDistHtml(html, alwaysExists)).toEqual([]);
  });

  it('marca las referencias absolutas desde la raíz', () => {
    const html = '<script src="/assets/index-abc.js"></script>';

    const issues = checkDistHtml(html, alwaysExists);

    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain('absoluta');
    expect(issues[0]).toContain('/assets/index-abc.js');
  });

  it('marca las referencias locales que no empiezan por ./', () => {
    const html = '<link rel="stylesheet" href="assets/index-abc.css" />';

    const issues = checkDistHtml(html, alwaysExists);

    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain('relativa');
  });

  it('marca las referencias relativas que no existen en dist/', () => {
    const html = '<script src="./assets/index-abc.js"></script>';

    const issues = checkDistHtml(html, neverExists);

    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain('no existe');
  });

  it('ignora referencias externas, protocol-relative, datos y fragmentos', () => {
    const html = [
      '<a href="https://www.cis.es/">CIS</a>',
      '<a href="//example.com/x">externo</a>',
      '<img src="data:image/gif;base64,R0lGOD" alt="" />',
      '<a href="mailto:hola@example.com">correo</a>',
      '<a href="#main">salto</a>',
    ].join('\n');

    expect(checkDistHtml(html, neverExists)).toEqual([]);
  });
});
