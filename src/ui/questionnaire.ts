import type { Question, Territory } from '../data/schema';

import { createButton, createOption, createPriorityToggle, el } from './components';

const NO_ANSWER_MESSAGE =
  'Selecciona al menos una respuesta o pulsa «No lo sé / omitir» para continuar.';

export interface TerritoryViewHandlers {
  onSelect: (territoryId: string) => void;
  onSubmit: () => void;
}

export interface TerritoryViewParams {
  territories: Territory[];
  selectedId: string | null;
  error: string | null;
  handlers: TerritoryViewHandlers;
}

export function renderTerritoryView(params: TerritoryViewParams): HTMLElement {
  const { territories, selectedId, error, handlers } = params;
  const selectId = 'territory-select';

  const select = el('select', {
    className: 'select',
    attrs: { id: selectId, name: 'territory', required: true },
  });
  select.append(el('option', { text: 'Selecciona una comunidad…', attrs: { value: '' } }));
  for (const territory of territories) {
    select.append(el('option', { text: territory.name, attrs: { value: territory.id } }));
  }
  if (selectedId !== null) select.value = selectedId;
  select.addEventListener('change', () => handlers.onSelect(select.value));

  const field = el('div', { className: 'field' }, [
    el('label', { className: 'field__label', text: 'Comunidad autónoma', attrs: { for: selectId } }),
    select,
    el('p', {
      className: 'field__error',
      text: error ?? '',
      attrs: { id: 'territory-error', role: 'alert', hidden: error === null },
    }),
  ]);

  const submit = createButton({ label: 'Continuar', variant: 'primary', type: 'submit' });
  const form = el('form', { className: 'territory-form', attrs: { novalidate: true } }, [
    field,
    submit,
  ]);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    handlers.onSubmit();
  });

  return el(
    'section',
    {
      className: 'view view--territory',
      attrs: { 'aria-labelledby': 'territory-heading' },
    },
    [
      el('h2', {
        className: 'view__title',
        text: 'Elige tu comunidad autónoma',
        attrs: { id: 'territory-heading', tabindex: '-1' },
      }),
      el('p', {
        className: 'lead',
        text: 'Tu territorio determina qué partidos pueden votarse. Podrás revisar tus respuestas antes de terminar.',
      }),
      el('div', { className: 'panel' }, [form]),
    ],
  );
}

export interface QuestionViewHandlers {
  onAnswer: (optionIds: string[]) => void;
  onTogglePriority: () => void;
  onPrevious: () => void;
  onSkip: () => void;
  onSubmit: () => void;
}

export interface QuestionViewParams {
  question: Question;
  topicName: string | null;
  index: number;
  total: number;
  selectedOptionIds: string[];
  priority: boolean;
  handlers: QuestionViewHandlers;
}

export function renderQuestionView(params: QuestionViewParams): HTMLElement {
  const { question, topicName, index, total, selectedOptionIds, priority, handlers } = params;
  const inputType = question.type === 'multi' ? 'checkbox' : 'radio';
  const groupName = `question-${question.id}`;

  const options = el('div', { className: 'options' });
  for (const option of question.options) {
    options.append(
      createOption({
        type: inputType,
        name: groupName,
        value: option.id,
        label: option.label,
        id: `${groupName}-${option.id}`,
        checked: selectedOptionIds.includes(option.id),
      }),
    );
  }

  const readSelected = (): string[] =>
    Array.from(options.querySelectorAll<HTMLInputElement>('input:checked')).map(
      (input) => input.value,
    );

  const errorNode = el('p', {
    className: 'question-error field__error',
    attrs: { role: 'alert', hidden: true },
  });

  options.addEventListener('change', () => {
    errorNode.hidden = true;
    errorNode.textContent = '';
    handlers.onAnswer(readSelected());
  });

  const legend = el('legend', { className: 'question-legend' }, [
    el('h2', {
      className: 'question-heading',
      text: question.text,
      attrs: { id: 'question-heading', tabindex: '-1' },
    }),
  ]);

  const fieldset = el('fieldset', { className: 'question-fieldset' }, [legend, options]);

  const priorityToggle = createPriorityToggle({
    id: `priority-${question.id}`,
    name: `priority-${question.id}`,
    checked: priority,
    label: 'Marcar este tema como prioritario',
  });
  priorityToggle.querySelector('input')?.addEventListener('change', () => {
    handlers.onTogglePriority();
  });

  const previousButton = createButton({ label: 'Anterior', variant: 'secondary', action: 'previous' });
  previousButton.disabled = index === 0;
  previousButton.addEventListener('click', () => handlers.onPrevious());

  const skipButton = createButton({ label: 'No lo sé / omitir', variant: 'ghost', action: 'skip' });
  skipButton.addEventListener('click', () => handlers.onSkip());

  const nextButton = createButton({
    label: index + 1 === total ? 'Finalizar' : 'Siguiente',
    variant: 'primary',
    type: 'submit',
    action: 'next',
  });

  const form = el('form', { className: 'question-form', attrs: { novalidate: true } }, [
    fieldset,
    el('div', { className: 'priority-row' }, [priorityToggle]),
    errorNode,
    el('div', { className: 'actions' }, [previousButton, skipButton, nextButton]),
  ]);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (readSelected().length === 0) {
      errorNode.hidden = false;
      errorNode.textContent = NO_ANSWER_MESSAGE;
      options.querySelector<HTMLInputElement>('input')?.focus();
      return;
    }
    handlers.onSubmit();
  });

  const progressFill = el('span', { className: 'progress__fill' });
  progressFill.style.width = `${Math.round(((index + 1) / total) * 100)}%`;

  const progress = el('div', { className: 'progress' }, [
    el('p', {
      className: 'progress__label',
      text: `Pregunta ${index + 1} de ${total}`,
      attrs: { id: 'progress-label' },
    }),
    el(
      'div',
      {
        className: 'progress__bar',
        attrs: {
          role: 'progressbar',
          'aria-valuemin': 1,
          'aria-valuemax': total,
          'aria-valuenow': index + 1,
          'aria-labelledby': 'progress-label',
        },
      },
      [progressFill],
    ),
  ]);

  const children: (Node | string)[] = [progress];
  if (topicName !== null) {
    children.push(el('p', { className: 'topic', text: `Tema: ${topicName}` }));
  }
  children.push(el('div', { className: 'panel' }, [form]));

  return el(
    'section',
    {
      className: 'view view--question',
      attrs: { 'aria-labelledby': 'question-heading' },
    },
    children,
  );
}
