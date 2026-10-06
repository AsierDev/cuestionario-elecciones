// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';

import { loadData } from '../../src/data/load';
import type { Question, Territory } from '../../src/data/schema';
import { renderQuestionView, renderTerritoryView } from '../../src/ui/questionnaire';
import { topic } from '../fixtures/scoring';

const data = loadData();

const territories: Territory[] = Array.from({ length: 19 }, (_, index) => ({
  id: `t-${index + 1}`,
  name: `Territorio ${index + 1}`,
}));

const topics = ['tema-1', 'tema-2', 'tema-3', 'tema-4', 'tema-5', 'tema-6'].map((id) => topic(id));

function singleQuestion(): Question {
  return {
    id: 'q1',
    topicId: 'tema-1',
    text: '¿Pregunta <b>uno</b>?',
    type: 'single',
    options: [
      { id: 'a', label: 'Opción <i>A</i>', value: -1 },
      { id: 'b', label: 'Opción B', value: 0 },
      { id: 'c', label: 'Opción C', value: 1 },
    ],
  };
}

function multiQuestion(): Question {
  return {
    id: 'q2',
    topicId: 'tema-2',
    text: '¿Qué opciones eliges?',
    type: 'multi',
    options: [
      { id: 'a', label: 'Opción A', value: -1 },
      { id: 'b', label: 'Opción B', value: 0 },
      { id: 'c', label: 'Opción C', value: 1 },
    ],
  };
}

function questionHandlers() {
  return {
    onAnswer: vi.fn(),
    onPrevious: vi.fn(),
    onSkip: vi.fn(),
    onSubmit: vi.fn(),
  };
}

function territoryHandlers() {
  return {
    onSelect: vi.fn(),
    onTogglePriorityTopic: vi.fn(),
    onSubmit: vi.fn(),
  };
}

describe('vista de territorio', () => {
  it('muestra las 19 comunidades y su etiqueta asociada', () => {
    const view = renderTerritoryView({
      territories,
      selectedId: null,
      error: null,
      topics,
      priorityTopicIds: [],
      handlers: territoryHandlers(),
    });

    const select = view.querySelector('select');
    expect(select).not.toBeNull();
    expect(select?.getAttribute('required')).not.toBeNull();

    const options = Array.from(select?.options ?? []).filter((option) => option.value !== '');
    expect(options).toHaveLength(19);

    const label = view.querySelector('label[for="territory-select"]');
    expect(label?.textContent).toBe('Comunidad autónoma');
  });

  it('notifica el territorio seleccionado al cambiar el select', () => {
    const handlers = territoryHandlers();
    const view = renderTerritoryView({
      territories,
      selectedId: null,
      error: null,
      topics,
      priorityTopicIds: [],
      handlers,
    });

    const select = view.querySelector('select');
    select!.value = 't-7';
    select!.dispatchEvent(new Event('change', { bubbles: true }));

    expect(handlers.onSelect).toHaveBeenCalledWith('t-7');
  });

  it('muestra el mensaje de error cuando falta el territorio', () => {
    const view = renderTerritoryView({
      territories,
      selectedId: null,
      error: 'Selecciona una comunidad autónoma para continuar.',
      topics,
      priorityTopicIds: [],
      handlers: territoryHandlers(),
    });

    const error = view.querySelector('#territory-error');
    expect(error?.hasAttribute('hidden')).toBe(false);
    expect(error?.textContent).toContain('Selecciona una comunidad');
  });

  it('mantiene un único h2 con tabindex -1', () => {
    const view = renderTerritoryView({
      territories,
      selectedId: null,
      error: null,
      topics,
      priorityTopicIds: [],
      handlers: territoryHandlers(),
    });

    expect(view.querySelectorAll('h2[tabindex="-1"]')).toHaveLength(1);
  });
});

describe('temas prioritarios en la vista de territorio', () => {
  function renderTerritory(priorityTopicIds: string[], handlers = territoryHandlers()) {
    return renderTerritoryView({
      territories,
      selectedId: null,
      error: null,
      topics,
      priorityTopicIds,
      handlers,
    });
  }

  it('muestra un checkbox por tema con name priority-topics y su nombre como etiqueta', () => {
    const view = renderTerritory([]);

    const inputs = Array.from(
      view.querySelectorAll<HTMLInputElement>('input[name="priority-topics"]'),
    );
    expect(inputs).toHaveLength(topics.length);
    expect(inputs.map((input) => input.closest('label')?.textContent)).toEqual(
      topics.map((item) => item.name),
    );
    expect(view.querySelector('legend')?.textContent).toBe('Temas prioritarios (opcional, máximo 5)');
  });

  it('deshabilita los temas no marcados al llegar a cinco seleccionados', () => {
    const view = renderTerritory(['tema-1', 'tema-2', 'tema-3', 'tema-4', 'tema-5']);

    const inputs = Array.from(
      view.querySelectorAll<HTMLInputElement>('input[name="priority-topics"]'),
    );
    const disabled = inputs.filter((input) => input.disabled);
    expect(disabled).toHaveLength(1);
    expect(disabled[0]?.id).toBe('priority-topic-tema-6');
  });

  it('notifica el tema marcado al cambiar el checkbox', () => {
    const handlers = territoryHandlers();
    const view = renderTerritory([], handlers);

    const input = view.querySelector<HTMLInputElement>('#priority-topic-tema-2');
    input!.checked = true;
    input!.dispatchEvent(new Event('change', { bubbles: true }));

    expect(handlers.onTogglePriorityTopic).toHaveBeenCalledWith('tema-2');
  });

  it('revierte un sexto tema y no notifica el cambio', () => {
    const handlers = territoryHandlers();
    const view = renderTerritory(['tema-1', 'tema-2', 'tema-3', 'tema-4', 'tema-5'], handlers);

    const input = view.querySelector<HTMLInputElement>('#priority-topic-tema-6');
    input!.checked = true;
    input!.dispatchEvent(new Event('change', { bubbles: true }));

    expect(handlers.onTogglePriorityTopic).not.toHaveBeenCalled();
    expect(input!.checked).toBe(false);
  });
});

describe('vista de pregunta', () => {
  it('usa fieldset/legend con el enunciado como h2 y un input por opción', () => {
    const view = renderQuestionView({
      question: singleQuestion(),
      topicName: 'Tema uno',
      index: 0,
      total: 25,
      selectedOptionIds: [],
      handlers: questionHandlers(),
    });

    const fieldset = view.querySelector('fieldset');
    expect(fieldset).not.toBeNull();
    const heading = fieldset?.querySelector('legend h2');
    expect(heading?.textContent).toBe('¿Pregunta <b>uno</b>?');

    const inputs = Array.from(fieldset?.querySelectorAll('input') ?? []);
    expect(inputs).toHaveLength(3);
    expect(inputs.every((input) => input.type === 'radio')).toBe(true);
    expect(new Set(inputs.map((input) => input.name)).size).toBe(1);
  });

  it('usa checkboxes en las preguntas de selección múltiple', () => {
    const view = renderQuestionView({
      question: multiQuestion(),
      topicName: null,
      index: 3,
      total: 25,
      selectedOptionIds: [],
      handlers: questionHandlers(),
    });

    const inputs = Array.from(view.querySelectorAll<HTMLInputElement>('.options input'));
    expect(inputs.every((input) => input.type === 'checkbox')).toBe(true);
  });

  it('usa un name distinto por pregunta', () => {
    const handlers = questionHandlers();
    const first = renderQuestionView({
      question: singleQuestion(),
      topicName: null,
      index: 0,
      total: 25,
      selectedOptionIds: [],
      handlers,
    });
    const second = renderQuestionView({
      question: multiQuestion(),
      topicName: null,
      index: 1,
      total: 25,
      selectedOptionIds: [],
      handlers,
    });

    expect(first.querySelector('input')?.name).not.toBe(second.querySelector('input')?.name);
  });

  it('no muestra el toggle de prioridad por pregunta', () => {
    const view = renderQuestionView({
      question: singleQuestion(),
      topicName: null,
      index: 0,
      total: 25,
      selectedOptionIds: [],
      handlers: questionHandlers(),
    });

    expect(view.querySelector('.priority-row')).toBeNull();
    expect(view.querySelector('input[name^="priority-"]')).toBeNull();
  });

  it('muestra el progreso y conserva la selección previa', () => {
    const view = renderQuestionView({
      question: singleQuestion(),
      topicName: 'Tema uno',
      index: 4,
      total: 25,
      selectedOptionIds: ['b'],
      handlers: questionHandlers(),
    });

    expect(view.querySelector('.progress__label')?.textContent).toBe('Pregunta 5 de 25');
    const checked = view.querySelector<HTMLInputElement>('input:checked');
    expect(checked?.value).toBe('b');
  });

  it('notifica la respuesta al cambiar una opción', () => {
    const handlers = questionHandlers();
    const view = renderQuestionView({
      question: singleQuestion(),
      topicName: null,
      index: 0,
      total: 25,
      selectedOptionIds: [],
      handlers,
    });

    const input = view.querySelector<HTMLInputElement>('input[value="a"]');
    input!.checked = true;
    input!.dispatchEvent(new Event('change', { bubbles: true }));

    expect(handlers.onAnswer).toHaveBeenCalledWith(['a']);
  });

  it('exige una respuesta antes de avanzar', () => {
    const handlers = questionHandlers();
    const view = renderQuestionView({
      question: singleQuestion(),
      topicName: null,
      index: 0,
      total: 25,
      selectedOptionIds: [],
      handlers,
    });

    const form = view.querySelector('form');
    form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    expect(handlers.onSubmit).not.toHaveBeenCalled();
    expect(view.querySelector('.question-error')?.hasAttribute('hidden')).toBe(false);
    expect(view.querySelector('.question-error')?.textContent).toContain('Selecciona al menos una');
  });

  it('escapa el texto en lugar de interpretarlo como HTML', () => {
    const view = renderQuestionView({
      question: { ...singleQuestion(), text: '<script>alert(1)</script>' },
      topicName: null,
      index: 0,
      total: 25,
      selectedOptionIds: [],
      handlers: questionHandlers(),
    });

    expect(view.querySelector('script')).toBeNull();
    expect(view.querySelector('h2')?.textContent).toBe('<script>alert(1)</script>');
  });

  it('no revela ningún nombre de partido en la vista de preguntas', () => {
    const view = renderQuestionView({
      question: singleQuestion(),
      topicName: 'Tema uno',
      index: 0,
      total: 25,
      selectedOptionIds: [],
      handlers: questionHandlers(),
    });

    const text = view.textContent ?? '';
    for (const party of data.parties) {
      expect(text).not.toContain(party.displayName);
    }
  });
});
