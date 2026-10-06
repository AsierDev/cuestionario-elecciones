import { ANSWER_SCALE, SCORING_CONFIG } from '../core/config';
import type { Question, Territory, Topic } from '../data/schema';

import { createButton, el } from './components';
import { formatFactor } from './format';
import { MAX_PRIORITY_TOPICS } from './state';

const NO_ANSWER_MESSAGE =
  'Elige una posición en la escala o pulsa «Sin opinión» para pasar a la siguiente.';

export interface IntroViewHandlers {
  onSelect: (territoryId: string) => void;
  onTogglePriorityTopic: (topicId: string) => void;
  onSubmit: () => void;
}

export interface IntroViewParams {
  territories: Territory[];
  selectedId: string | null;
  error: string | null;
  topics: Topic[];
  questionCount: number;
  priorityTopicIds: string[];
  handlers: IntroViewHandlers;
}

function renderSteps(questionCount: number): HTMLElement {
  const steps = [
    ['Elige tu comunidad', 'Así solo comparamos con los partidos que puedes votar.'],
    [
      `Responde ${questionCount} propuestas`,
      'Cada una explica qué es, qué cambiaría y qué implica estar a favor o en contra.',
    ],
    ['Descubre tu afinidad', 'Con cada partido, tema a tema y propuesta a propuesta.'],
  ];
  return el(
    'ol',
    { className: 'steps' },
    steps.map(([title, text], index) =>
      el('li', { className: 'steps__item' }, [
        el('span', { className: 'steps__number', text: String(index + 1), attrs: { 'aria-hidden': 'true' } }),
        el('span', { className: 'steps__body' }, [
          el('strong', { className: 'steps__title', text: title }),
          el('span', { className: 'steps__text', text }),
        ]),
      ]),
    ),
  );
}

export function renderIntroView(params: IntroViewParams): HTMLElement {
  const { territories, selectedId, error, topics, questionCount, priorityTopicIds, handlers } =
    params;
  const selectId = 'territory-select';

  const select = el('select', {
    className: 'select',
    attrs: {
      id: selectId,
      name: 'territory',
      required: true,
      'aria-describedby': 'territory-hint territory-error',
    },
  });
  select.append(el('option', { text: 'Selecciona tu comunidad…', attrs: { value: '' } }));
  for (const territory of territories) {
    select.append(el('option', { text: territory.name, attrs: { value: territory.id } }));
  }
  if (selectedId !== null) select.value = selectedId;
  select.addEventListener('change', () => handlers.onSelect(select.value));

  const field = el('div', { className: 'field' }, [
    el('label', { className: 'field__label', text: 'Comunidad autónoma', attrs: { for: selectId } }),
    el('p', {
      className: 'field__hint',
      text: 'Determina qué partidos concurren en tu territorio.',
      attrs: { id: 'territory-hint' },
    }),
    select,
    el('p', {
      className: 'field__error',
      text: error ?? '',
      attrs: { id: 'territory-error', role: 'alert', hidden: error === null },
    }),
  ]);

  const priorityOptions = el('div', { className: 'topic-picker' });
  const counter = el('span', {
    className: 'topic-picker__counter',
    text: `${priorityTopicIds.length}/${MAX_PRIORITY_TOPICS}`,
    attrs: { 'aria-hidden': 'true' },
  });

  const syncPriority = (): void => {
    const inputs = Array.from(
      priorityOptions.querySelectorAll<HTMLInputElement>('input[name="priority-topics"]'),
    );
    const marked = inputs.filter((input) => input.checked).length;
    for (const input of inputs) {
      input.disabled = !input.checked && marked >= MAX_PRIORITY_TOPICS;
    }
    counter.textContent = `${marked}/${MAX_PRIORITY_TOPICS}`;
  };

  for (const topic of topics) {
    const id = `priority-topic-${topic.id}`;
    const checked = priorityTopicIds.includes(topic.id);
    const input = el('input', {
      className: 'topic-card__input',
      attrs: { type: 'checkbox', name: 'priority-topics', id, value: topic.id },
    });
    input.checked = checked;
    input.disabled = !checked && priorityTopicIds.length >= MAX_PRIORITY_TOPICS;
    input.addEventListener('change', () => {
      handlers.onTogglePriorityTopic(topic.id);
      syncPriority();
    });
    priorityOptions.append(
      el('label', { className: 'topic-card', attrs: { for: id } }, [
        input,
        el('span', { className: 'topic-card__body' }, [
          el('span', { className: 'topic-card__name', text: topic.name }),
          el('span', { className: 'topic-card__description', text: topic.description }),
        ]),
        el('span', { className: 'topic-card__check', attrs: { 'aria-hidden': 'true' } }),
      ]),
    );
  }

  const priorityFieldset = el(
    'fieldset',
    { className: 'priority-topics', attrs: { 'aria-describedby': 'priority-topics-hint' } },
    [
      el('legend', { className: 'priority-topics__legend' }, [
        el('span', { text: `¿Qué temas te importan más? ` }),
        el('span', {
          className: 'priority-topics__optional',
          text: `Opcional, hasta ${MAX_PRIORITY_TOPICS}`,
        }),
      ]),
      el('p', {
        className: 'priority-topics__hint',
        attrs: { id: 'priority-topics-hint' },
      }, [
        `Las propuestas de esos temas pesarán ${formatFactor(SCORING_CONFIG.priorityFactor)} veces más en tu resultado. `,
        counter,
      ]),
      priorityOptions,
    ],
  );

  const submit = createButton({
    label: 'Empezar el cuestionario',
    variant: 'primary',
    type: 'submit',
    action: 'start',
  });
  const form = el('form', { className: 'panel intro-form', attrs: { novalidate: true } }, [
    field,
    priorityFieldset,
    el('div', { className: 'intro-form__footer' }, [
      submit,
      el('p', {
        className: 'intro-form__note',
        text: 'Unos 8 minutos. Tus respuestas no salen de tu navegador.',
      }),
    ]),
  ]);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    handlers.onSubmit();
  });

  return el(
    'section',
    { className: 'view view--intro', attrs: { 'aria-labelledby': 'intro-heading' } },
    [
      el('div', { className: 'hero' }, [
        el('p', { className: 'eyebrow', text: 'Elecciones generales · 29 de noviembre de 2026' }),
        el('h2', {
          className: 'hero__title',
          text: '¿Con qué partidos coincides de verdad?',
          attrs: { id: 'intro-heading', tabindex: '-1' },
        }),
        el('p', {
          className: 'hero__lead',
          text: `Te planteamos ${questionCount} propuestas concretas sobre las que los partidos discrepan. No verás quién defiende cada una hasta el final, para que respondas por lo que dice la medida y no por quién la propone.`,
        }),
        renderSteps(questionCount),
      ]),
      form,
    ],
  );
}

export interface QuestionViewHandlers {
  onAnswer: (value: number) => void;
  onPrevious: () => void;
  onSkip: () => void;
  onSubmit: () => void;
}

export interface QuestionViewParams {
  question: Question;
  topicName: string | null;
  priority: boolean;
  index: number;
  total: number;
  answered: number;
  selectedValue: number | undefined;
  handlers: QuestionViewHandlers;
}

function renderExplainer(question: Question): HTMLDetailsElement {
  const block = (title: string, text: string, className: string): HTMLElement =>
    el('section', { className }, [
      el('h3', { className: 'explainer__title', text: title }),
      el('p', { className: 'explainer__text', text }),
    ]);

  const body = el('div', { className: 'explainer__body' }, [
    el('div', { className: 'explainer__facts' }, [
      block('Situación actual', question.context, 'explainer__block'),
      block('Qué cambiaría si se aplica', question.change, 'explainer__block'),
    ]),
    el('div', { className: 'explainer__sides' }, [
      block('Si estás en contra', question.ifAgainst, 'explainer__side explainer__side--against'),
      block('Si estás a favor', question.ifFavor, 'explainer__side explainer__side--favor'),
    ]),
  ]);

  if (question.glossary.length > 0) {
    const list = el('dl', { className: 'glossary' });
    for (const entry of question.glossary) {
      list.append(
        el('dt', { className: 'glossary__term', text: entry.term }),
        el('dd', { className: 'glossary__definition', text: entry.definition }),
      );
    }
    body.append(
      el('section', { className: 'explainer__glossary' }, [
        el('h3', { className: 'explainer__title', text: 'Términos' }),
        list,
      ]),
    );
  }

  const summary = el('summary', { className: 'explainer__summary' }, [
    el('span', { className: 'explainer__summary-label', text: 'Entender la propuesta' }),
    el('span', {
      className: 'explainer__summary-hint',
      text: 'Situación actual, qué cambiaría y qué implica tu respuesta',
    }),
  ]);

  return el('details', { className: 'explainer' }, [summary, body]);
}

function renderScale(question: Question, selectedValue: number | undefined): HTMLFieldSetElement {
  const groupName = `answer-${question.id}`;
  const options = el('div', { className: 'scale__options' });
  ANSWER_SCALE.forEach((point, index) => {
    const id = `${groupName}-${index}`;
    const input = el('input', {
      className: 'scale__input',
      attrs: { type: 'radio', name: groupName, id, value: String(point.value) },
    });
    input.checked = selectedValue === point.value;
    options.append(
      el('label', { className: `scale__option scale__option--${index}`, attrs: { for: id } }, [
        input,
        el('span', { className: 'scale__dot', attrs: { 'aria-hidden': 'true' } }),
        el('span', { className: 'scale__label', text: point.label }),
      ]),
    );
  });

  return el('fieldset', { className: 'scale' }, [
    el('legend', { className: 'visually-hidden', text: 'Tu posición sobre la propuesta' }),
    el('div', { className: 'scale__track', attrs: { 'aria-hidden': 'true' } }),
    options,
  ]);
}

export function renderQuestionView(params: QuestionViewParams): HTMLElement {
  const { question, topicName, priority, index, total, answered, selectedValue, handlers } =
    params;

  const scale = renderScale(question, selectedValue);
  const readSelected = (): number | undefined => {
    const checked = scale.querySelector<HTMLInputElement>('input:checked');
    return checked ? Number(checked.value) : undefined;
  };

  const errorNode = el('p', {
    className: 'question-error field__error',
    attrs: { role: 'alert', hidden: true },
  });

  scale.addEventListener('change', () => {
    errorNode.hidden = true;
    errorNode.textContent = '';
    const value = readSelected();
    if (value !== undefined) handlers.onAnswer(value);
  });

  const previousButton = createButton({ label: 'Anterior', variant: 'secondary', action: 'previous' });
  previousButton.disabled = index === 0;
  previousButton.addEventListener('click', () => handlers.onPrevious());

  const skipButton = createButton({ label: 'Sin opinión', variant: 'ghost', action: 'skip' });
  skipButton.title = 'Saltar esta propuesta: no contará en tu resultado';
  skipButton.addEventListener('click', () => handlers.onSkip());

  const isLast = index + 1 === total;
  const nextButton = createButton({
    label: isLast ? 'Ver resultados' : 'Siguiente',
    variant: 'primary',
    type: 'submit',
    action: 'next',
  });

  const form = el('form', { className: 'question-form', attrs: { novalidate: true } }, [
    scale,
    el('p', {
      className: 'scale__note',
      text: '«Sin opinión» no cuenta en el cálculo. La posición central sí cuenta, como postura intermedia.',
    }),
    errorNode,
    el('div', { className: 'actions actions--question' }, [
      previousButton,
      el('div', { className: 'actions__right' }, [skipButton, nextButton]),
    ]),
  ]);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (readSelected() === undefined) {
      errorNode.hidden = false;
      errorNode.textContent = NO_ANSWER_MESSAGE;
      scale.querySelector<HTMLInputElement>('input')?.focus();
      return;
    }
    handlers.onSubmit();
  });

  const progressFill = el('span', { className: 'progress__fill' });
  progressFill.style.width = `${Math.round(((index + 1) / total) * 100)}%`;

  const meta: (Node | string)[] = [];
  if (topicName !== null) meta.push(el('span', { className: 'topic-chip', text: topicName }));
  if (priority) meta.push(el('span', { className: 'badge', text: 'Tema prioritario' }));

  const progress = el('div', { className: 'progress' }, [
    el('div', { className: 'progress__row' }, [
      el('div', { className: 'progress__meta' }, meta),
      el('p', {
        className: 'progress__label',
        text: `Pregunta ${index + 1} de ${total}`,
        attrs: { id: 'progress-label' },
      }),
    ]),
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
    el('p', {
      className: 'progress__answered',
      text: `${answered} respondidas`,
    }),
  ]);

  const card = el('article', { className: 'question-card' }, [
    el('p', { className: 'question-card__kicker', text: question.title }),
    el('h2', {
      className: 'question-card__statement',
      text: question.statement,
      attrs: { id: 'question-heading', tabindex: '-1' },
    }),
    el('p', { className: 'question-card__summary', text: question.summary }),
    renderExplainer(question),
    form,
  ]);

  return el(
    'section',
    { className: 'view view--question', attrs: { 'aria-labelledby': 'question-heading' } },
    [progress, card],
  );
}
