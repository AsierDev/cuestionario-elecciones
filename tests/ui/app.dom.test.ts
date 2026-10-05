// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

async function mountEntryPoint(): Promise<void> {
  vi.resetModules();
  await import('../../src/main');
}

function territoryForm(): HTMLFormElement {
  const form = document.querySelector<HTMLFormElement>('.territory-form');
  if (!form) throw new Error('No se encontró el formulario de territorio');
  return form;
}

function submitForm(form: HTMLFormElement): void {
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

function chooseTerritory(value: string): void {
  const select = document.querySelector<HTMLSelectElement>('#territory-select');
  if (!select) throw new Error('No se encontró el selector de territorio');
  select.value = value;
  select.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('punto de entrada del sitio', () => {
  beforeEach(() => {
    document.body.innerHTML = '<main id="app"></main>';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('monta el selector de territorio con las 19 comunidades y la cabecera', async () => {
    await mountEntryPoint();

    expect(document.querySelector('.app-title')?.textContent).toBe(
      'Buscador de afinidad de voto',
    );
    expect(document.querySelector('#app-status')?.getAttribute('aria-live')).toBe('polite');

    const select = document.querySelector<HTMLSelectElement>('#territory-select');
    expect(select).not.toBeNull();
    const options = Array.from(select?.options ?? []).filter((option) => option.value !== '');
    expect(options).toHaveLength(19);
  });

  it('no avanza al cuestionario sin territorio seleccionado', async () => {
    await mountEntryPoint();
    submitForm(territoryForm());

    expect(document.querySelector('#territory-error')?.hasAttribute('hidden')).toBe(false);
    expect(document.querySelector('#question-heading')).toBeNull();
  });

  it('no avanza si se vuelve al placeholder vacío tras elegir una comunidad', async () => {
    await mountEntryPoint();

    chooseTerritory('cataluna');
    chooseTerritory('');
    submitForm(territoryForm());

    expect(document.querySelector('#territory-error')?.hasAttribute('hidden')).toBe(false);
    expect(document.querySelector('#question-heading')).toBeNull();
  });

  it('oculta el error de territorio al corregir la selección', async () => {
    await mountEntryPoint();

    submitForm(territoryForm());
    expect(document.querySelector('#territory-error')?.hasAttribute('hidden')).toBe(false);

    chooseTerritory('cataluna');
    expect(document.querySelector('#territory-error')?.hasAttribute('hidden')).toBe(true);
  });

  it('muestra la primera pregunta tras elegir una comunidad y continuar', async () => {
    await mountEntryPoint();

    chooseTerritory('cataluna');
    submitForm(territoryForm());

    expect(document.querySelector('.progress__label')?.textContent).toBe('Pregunta 1 de 25');
    expect(document.querySelector('fieldset legend h2')?.textContent).toBeTruthy();
    expect(document.querySelector('#question-heading')).not.toBeNull();
    expect(document.querySelector('#territory-select')).toBeNull();
  });

  it('completa el flujo hasta los resultados y la metodología', async () => {
    await mountEntryPoint();

    chooseTerritory('cataluna');
    submitForm(territoryForm());

    for (let index = 0; index < 25; index += 1) {
      const input = document.querySelector<HTMLInputElement>('.options input');
      if (!input) throw new Error('No se encontró ninguna opción');
      input.checked = true;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      const form = document.querySelector<HTMLFormElement>('.question-form');
      if (!form) throw new Error('No se encontró el formulario de pregunta');
      submitForm(form);
    }

    expect(document.querySelector('#results-heading')?.textContent).toBe('Resultados');
    expect(document.querySelector('.ranking')).not.toBeNull();

    document.querySelector<HTMLButtonElement>('button[data-action="methodology"]')?.click();
    expect(document.querySelector('#methodology-heading')?.textContent).toBe('Metodología');

    document.querySelector<HTMLButtonElement>('button[data-action="back"]')?.click();
    expect(document.querySelector('#results-heading')?.textContent).toBe('Resultados');
  });
});
