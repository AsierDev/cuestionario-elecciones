// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { loadData } from '../../src/data/load';

const data = loadData();

async function mountEntryPoint(): Promise<void> {
  vi.resetModules();
  await import('../../src/main');
}

function submit(selector: string): void {
  const form = document.querySelector<HTMLFormElement>(selector);
  if (!form) throw new Error(`No se encontró ${selector}`);
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

function chooseTerritory(value: string): void {
  const select = document.querySelector<HTMLSelectElement>('#territory-select');
  if (!select) throw new Error('No se encontró el selector de territorio');
  select.value = value;
  select.dispatchEvent(new Event('change', { bubbles: true }));
}

function pick(index: number): void {
  const inputs = document.querySelectorAll<HTMLInputElement>('.scale__input');
  const input = inputs[index];
  if (!input) throw new Error(`No hay opción ${index}`);
  input.checked = true;
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function click(action: string): void {
  const button = document.querySelector<HTMLButtonElement>(`button[data-action="${action}"]`);
  if (!button) throw new Error(`No se encontró el botón ${action}`);
  button.click();
}

function heading(): string {
  return document.querySelector('h2')?.textContent ?? '';
}

async function startIn(territoryId: string): Promise<void> {
  await mountEntryPoint();
  chooseTerritory(territoryId);
  submit('.intro-form');
}

describe('flujo completo', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('monta la portada con las 19 comunidades y los temas prioritarios', async () => {
    await mountEntryPoint();
    expect(document.querySelector('.app-title')?.textContent).toContain('Brújula de voto');
    expect(document.querySelector('#app-status')?.getAttribute('aria-live')).toBe('polite');
    const options = Array.from(
      document.querySelector<HTMLSelectElement>('#territory-select')?.options ?? [],
    ).filter((option) => option.value !== '');
    expect(options).toHaveLength(19);
    expect(document.querySelectorAll('input[name="priority-topics"]')).toHaveLength(
      data.topics.length,
    );
  });

  it('no avanza sin territorio y oculta el error al corregirlo', async () => {
    await mountEntryPoint();
    submit('.intro-form');
    expect(document.querySelector('#territory-error')?.hasAttribute('hidden')).toBe(false);
    expect(document.querySelector('#question-heading')).toBeNull();
    chooseTerritory('galicia');
    expect(document.querySelector('#territory-error')?.hasAttribute('hidden')).toBe(true);
  });

  it('bloquea más de tres temas prioritarios', async () => {
    await mountEntryPoint();
    const inputs = Array.from(
      document.querySelectorAll<HTMLInputElement>('input[name="priority-topics"]'),
    );
    for (const input of inputs.slice(0, 3)) {
      input.checked = true;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
    expect(inputs.slice(3).every((input) => input.disabled)).toBe(true);
    expect(document.querySelector('.topic-picker__counter')?.textContent).toBe('3/3');
  });

  it('muestra la propuesta, su explicación y la escala sin nombrar partidos', async () => {
    await startIn('madrid');
    const first = data.questions[0];
    expect(heading()).toBe(first?.statement);
    expect(document.querySelectorAll('.scale__input')).toHaveLength(5);
    const explainer = document.querySelector('.explainer')?.textContent ?? '';
    expect(explainer).toContain(first?.context ?? '');
    expect(explainer).toContain(first?.ifFavor ?? '');
    expect(explainer).toContain(first?.ifAgainst ?? '');
    const viewText = document.querySelector('.view--question')?.textContent ?? '';
    for (const party of data.parties) expect(viewText).not.toContain(party.displayName);
  });

  it('exige una respuesta o «Sin opinión» para avanzar y recuerda la elegida', async () => {
    await startIn('madrid');
    submit('.question-form');
    expect(document.querySelector('.question-error')?.hasAttribute('hidden')).toBe(false);
    pick(4);
    submit('.question-form');
    expect(heading()).toBe(data.questions[1]?.statement);
    click('previous');
    const checked = document.querySelector<HTMLInputElement>('.scale__input:checked');
    expect(checked?.value).toBe('1');
  });

  it('muestra ranking, mapa de temas y propuesta a propuesta al terminar', async () => {
    await startIn('cataluna');
    data.questions.forEach((_, index) => {
      if (index === 3) {
        click('skip');
        return;
      }
      pick(index % 5);
      submit('.question-form');
    });

    expect(document.querySelector('#results-heading')).not.toBeNull();
    expect(document.querySelector('.results-hero')?.textContent).toContain(
      `${data.questions.length - 1} de ${data.questions.length}`,
    );
    expect(document.querySelectorAll('#partidos .party-row').length).toBeGreaterThan(0);
    expect(document.querySelectorAll('.heatmap tbody tr')).toHaveLength(data.topics.length);
    expect(document.querySelectorAll('.proposal')).toHaveLength(data.questions.length - 1);
    expect(document.querySelectorAll('.pill--you')).toHaveLength(data.questions.length - 1);
    // Partidos catalanes incluidos; los de otros territorios, no.
    const ranking = document.querySelector('#partidos')?.textContent ?? '';
    expect(ranking).toContain('ERC');
    expect(document.querySelector('.others')?.textContent).toContain('BNG');
  });

  it('enseña coincidencias y discrepancias con fuente al desplegar un partido', async () => {
    await startIn('madrid');
    data.questions.forEach(() => {
      pick(4);
      submit('.question-form');
    });
    const row = document.querySelector('#partidos .party-row');
    expect(row?.querySelector('.agreement--match')).not.toBeNull();
    expect(row?.querySelector('.agreement--mismatch')).not.toBeNull();
    const links = row?.querySelectorAll<HTMLAnchorElement>('a.source-link') ?? [];
    expect(links.length).toBeGreaterThan(0);
    expect(links[0]?.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('avisa de comparación parcial con menos de diez respuestas', async () => {
    await startIn('madrid');
    data.questions.forEach((_, index) => {
      if (index < 3) {
        pick(0);
        submit('.question-form');
      } else {
        click('skip');
      }
    });
    expect(heading()).toBe('Comparación parcial');
    expect(document.querySelector('.ranking:not(.ranking--muted)')).toBeNull();
  });

  it('permite revisar respuestas, ver la metodología y reiniciar', async () => {
    await startIn('madrid');
    data.questions.forEach(() => click('skip'));
    expect(heading()).toBe('Resultados');
    click('review');
    expect(heading()).toBe(data.questions[0]?.statement);
    data.questions.forEach(() => click('skip'));
    click('methodology');
    expect(heading()).toBe('Metodología');
    click('back');
    click('restart');
    expect(document.querySelector('#territory-select')).not.toBeNull();
  });
});
