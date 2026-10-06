// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';

import { computeResults, type ScoringInput, type QuestionAnswer } from '../../src/core/scoring';
import type { DataBundle } from '../../src/data/schema';
import { renderMethodologyView } from '../../src/ui/methodology';
import { renderResultsView } from '../../src/ui/results';
import { makeBundle, party, position, question, topic } from '../fixtures/scoring';

const ALFA = party('partido-a', { displayName: 'Alfa' });
const BETA = party('partido-b', { displayName: 'Beta' });
const GAMMA = party('partido-c', {
  displayName: 'Gamma',
  scope: 'territorial',
  communities: ['t2'],
});

function answer(questionId: string, optionIds: string[]): QuestionAnswer {
  return { questionId, optionIds, priority: false };
}

function render(data: DataBundle, input: ScoringInput, updatedAt = '2026-10-05'): HTMLElement {
  return renderResultsView({
    data,
    results: computeResults(data, input),
    updatedAt,
    handlers: { onRestart: vi.fn(), onShowMethodology: vi.fn() },
  });
}

const bothAnswered: ScoringInput = {
  territoryId: 't1',
  answers: [answer('q1', ['q1-op2']), answer('q2', ['q2-op2'])],
};

describe('vista de resultados — ranking', () => {
  it('ordena por afinidad descendente con desempate alfabético y formato de un decimal', () => {
    const data = makeBundle({
      parties: [BETA, ALFA],
      topics: [topic('tema-1'), topic('tema-2')],
      questions: [question('q1', 'tema-1'), question('q2', 'tema-2')],
      positions: {
        'partido-a': [position('tema-1', 1), position('tema-2', 1)],
        'partido-b': [position('tema-1', -1), position('tema-2', -1)],
      },
    });

    const node = render(data, bothAnswered);

    const names = Array.from(node.querySelectorAll('.ranking__name')).map(
      (element) => element.textContent,
    );
    expect(names).toEqual(['Alfa', 'Beta']);
    expect(node.querySelector('.ranking__affinity')?.textContent).toBe('100,0 %');
    expect(node.querySelector('.ranking__meta')?.textContent).toContain('Cobertura: 100,0 %');
  });

  it('enlaza los programas en una pestaña nueva con rel de seguridad', () => {
    const data = makeBundle({
      parties: [ALFA],
      topics: [topic('tema-1')],
      questions: [question('q1', 'tema-1')],
      positions: { 'partido-a': [position('tema-1', 0)] },
    });

    const node = render(data, { territoryId: 't1', answers: [answer('q1', ['q1-op1'])] });

    for (const link of Array.from(node.querySelectorAll<HTMLAnchorElement>('.program-link'))) {
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.getAttribute('rel')).toBe('noopener noreferrer');
      expect(link.getAttribute('href')).toBe(ALFA.programUrl);
    }
  });

  it('lista los temas sin datos por partido', () => {
    const data = makeBundle({
      parties: [ALFA],
      topics: [topic('tema-1'), topic('tema-2')],
      questions: [question('q1', 'tema-1'), question('q2', 'tema-2')],
      positions: { 'partido-a': [position('tema-1', 0)] },
    });

    const node = render(data, bothAnswered);

    expect(node.querySelector('.ranking__missing')?.textContent).toContain('Tema tema-2');
  });

  it('excluye del ranking los partidos que no concurren y los lista aparte', () => {
    const data = makeBundle({
      parties: [ALFA, GAMMA],
      topics: [topic('tema-1')],
      questions: [question('q1', 'tema-1')],
      positions: {
        'partido-a': [position('tema-1', 0)],
        'partido-c': [position('tema-1', 1)],
      },
    });

    const node = render(data, { territoryId: 't1', answers: [answer('q1', ['q1-op1'])] });

    const ranked = Array.from(node.querySelectorAll('.ranking__name')).map(
      (element) => element.textContent,
    );
    expect(ranked).toEqual(['Alfa']);
    expect(node.querySelector('.non-applicable__list')?.textContent).toContain('Gamma');
    expect(node.querySelector('#results-non-applicable-heading')?.textContent).toBe(
      'Partidos que no concurren en tu comunidad',
    );
  });

  it('coloca bajo «Sin datos suficientes» los partidos sin cobertura, sin porcentaje', () => {
    const data = makeBundle({
      parties: [ALFA, BETA],
      topics: [topic('tema-1')],
      questions: [question('q1', 'tema-1')],
      positions: {
        'partido-a': [position('tema-1', null)],
        'partido-b': [position('tema-1', 0)],
      },
    });

    const node = render(data, { territoryId: 't1', answers: [answer('q1', ['q1-op1'])] });

    const withoutData = node.querySelector('#results-without-data-heading');
    expect(withoutData?.textContent).toBe('Sin datos suficientes');
    expect(node.querySelector('.without-data__list')?.textContent).toContain('Alfa');
    expect(node.querySelector('.ranking__name')?.textContent).toBe('Beta');
  });
});

describe('vista de resultados — ganadores por pregunta', () => {
  it('muestra todos los ganadores empatados en orden alfabético', () => {
    const data = makeBundle({
      parties: [BETA, ALFA],
      topics: [topic('tema-1')],
      questions: [question('q1', 'tema-1')],
      positions: {
        'partido-a': [position('tema-1', 0)],
        'partido-b': [position('tema-1', 0)],
      },
    });

    const node = render(data, { territoryId: 't1', answers: [answer('q1', ['q1-op1'])] });

    expect(node.querySelector('.winner__party')?.textContent).toBe('Más afín: Alfa, Beta');
    expect(node.querySelector('.winner__affinity')?.textContent).toBe('Afinidad: 100,0 %');
    expect(node.querySelector('.winner__answer')?.textContent).toBe('Tu respuesta: Opción 1');
  });

  it('muestra las etiquetas de todas las opciones elegidas en una pregunta múltiple', () => {
    const data = makeBundle({
      parties: [ALFA],
      topics: [topic('tema-1')],
      questions: [question('q1', 'tema-1', { type: 'multi' })],
      positions: { 'partido-a': [position('tema-1', 0)] },
    });

    const node = render(data, {
      territoryId: 't1',
      answers: [answer('q1', ['q1-op0', 'q1-op2'])],
    });

    expect(node.querySelector('.winner__answer')?.textContent).toBe(
      'Tu respuesta: Opción 0, Opción 2',
    );
  });

  it('avisa cuando no hay partidos aplicables con dato en una pregunta', () => {
    const data = makeBundle({
      parties: [ALFA, BETA],
      topics: [topic('tema-1'), topic('tema-2')],
      questions: [question('q1', 'tema-1'), question('q2', 'tema-2')],
      positions: {
        'partido-a': [position('tema-1', 0), position('tema-2', null)],
        'partido-b': [position('tema-1', null), position('tema-2', null)],
      },
    });

    const node = render(data, {
      territoryId: 't1',
      answers: [answer('q1', ['q1-op1']), answer('q2', ['q2-op1'])],
    });

    const winners = Array.from(node.querySelectorAll('.winner'));
    expect(winners).toHaveLength(2);
    expect(winners[1]?.querySelector('.winner__empty')?.textContent).toBe(
      'Sin datos suficientes en tu territorio para esta pregunta.',
    );
    expect(winners[0]?.querySelector('.winner__answer')?.textContent).toBe('Tu respuesta: Opción 1');
    expect(winners[1]?.querySelector('.winner__answer')?.textContent).toBe('Tu respuesta: Opción 1');
  });
});

describe('vista de resultados — aviso provisional y actualización', () => {
  it('avisa cuando alguna posición puntuada es provisional', () => {
    const data = makeBundle({
      parties: [ALFA],
      topics: [topic('tema-1')],
      questions: [question('q1', 'tema-1')],
      positions: { 'partido-a': [position('tema-1', 0, { status: 'provisional' })] },
    });

    const node = render(data, { territoryId: 't1', answers: [answer('q1', ['q1-op1'])] });

    expect(node.querySelector('.notice--warning')?.textContent).toContain(
      'datos provisionales',
    );
  });

  it('no avisa cuando todas las posiciones puntuadas son verificadas', () => {
    const data = makeBundle({
      parties: [ALFA],
      topics: [topic('tema-1')],
      questions: [question('q1', 'tema-1')],
      positions: { 'partido-a': [position('tema-1', 0)] },
    });

    const node = render(data, { territoryId: 't1', answers: [answer('q1', ['q1-op1'])] });

    expect(node.querySelector('.notice--warning')).toBeNull();
  });

  it('muestra la fecha de última actualización', () => {
    const data = makeBundle({
      parties: [ALFA],
      topics: [topic('tema-1')],
      questions: [question('q1', 'tema-1')],
      positions: { 'partido-a': [position('tema-1', 0)] },
    });

    const node = render(data, { territoryId: 't1', answers: [answer('q1', ['q1-op1'])] });

    expect(node.querySelector('.updated-at')?.textContent).toBe('Datos actualizados el 05/10/2026.');
  });
});

describe('vista de resultados — estados borde', () => {
  it('sin ninguna respuesta no muestra ranking ni porcentajes', () => {
    const data = makeBundle({
      parties: [ALFA],
      topics: [topic('tema-1')],
      questions: [question('q1', 'tema-1')],
      positions: { 'partido-a': [position('tema-1', 0)] },
    });

    const node = render(data, { territoryId: 't1', answers: [answer('q1', [])] });

    expect(node.textContent).toContain('No has respondido ninguna pregunta');
    expect(node.querySelector('.ranking')).toBeNull();
    expect(node.textContent).not.toContain('%');
  });
});

describe('vista de metodología', () => {
  const data = makeBundle({
    parties: [ALFA],
    topics: [topic('tema-1')],
    questions: [question('q1', 'tema-1')],
    positions: { 'partido-a': [position('tema-1', 0)] },
  });

  it('incluye las secciones obligatorias y el catálogo de evidencias', () => {
    const node = renderMethodologyView(data, { onBackToResults: vi.fn() });

    const text = node.textContent ?? '';
    expect(text).toContain('Cómo se calcula la afinidad');
    expect(text).toContain('Cobertura y datos faltantes');
    expect(text).toContain('Estados de los datos y actualización');
    expect(text).toContain('Neutralidad y orden');
    expect(text).toContain('Catálogo de temas y evidencias');
    expect(text).toContain('Alcance');
    expect(text).toContain('Reutilización y derechos');
    expect(node.querySelector('.evidence__link')).not.toBeNull();
  });

  it('explica el tipo de fuente «declaración» a partir de los datos', () => {
    const declarationData = makeBundle({
      parties: [ALFA],
      topics: [topic('tema-1')],
      questions: [question('q1', 'tema-1')],
      positions: {
        'partido-a': [position('tema-1', 0, { status: 'provisional', sourceType: 'declaracion' })],
      },
    });

    const node = renderMethodologyView(declarationData, { onBackToResults: vi.fn() });

    expect(node.textContent).toContain('declaración');
    expect(node.textContent).toContain('Alfa');
  });

  it('vuelve a los resultados con el botón', () => {
    const onBackToResults = vi.fn();
    const node = renderMethodologyView(data, { onBackToResults });

    node.querySelector<HTMLButtonElement>('button[data-action="back"]')?.click();

    expect(onBackToResults).toHaveBeenCalledOnce();
  });
});
