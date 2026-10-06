import { APP_NAME } from '../app/constants';
import { computeResults, type QuestionAnswer } from '../core/scoring';
import { loadData } from '../data/load';
import type { DataBundle, Question } from '../data/schema';

import { el } from './components';
import { renderMethodologyView } from './methodology';
import { renderIntroView, renderQuestionView } from './questionnaire';
import { renderResultsView } from './results';
import {
  answeredCount,
  createInitialState,
  currentQuestion,
  getAnswer,
  goNext,
  goPrevious,
  goToQuestion,
  MAX_PRIORITY_TOPICS,
  selectTerritory,
  setAnswer,
  skipCurrent,
  startQuestionnaire,
  togglePriorityTopic,
  type QuestionnaireState,
} from './state';

type ResultScreen = 'results' | 'methodology';

function collectAnswers(state: QuestionnaireState, questions: Question[]): QuestionAnswer[] {
  const priorityTopicIds = new Set(state.priorityTopicIds);
  const answers: QuestionAnswer[] = [];
  for (const question of questions) {
    const value = getAnswer(state, question.id);
    if (value !== undefined) {
      answers.push({ questionId: question.id, value, priority: priorityTopicIds.has(question.topicId) });
    }
  }
  return answers;
}

export function mountApp(container: HTMLElement, data: DataBundle = loadData()): void {
  container.textContent = '';

  const header = el('header', { className: 'app-header' }, [
    el('div', { className: 'app-header__inner' }, [
      el('p', { className: 'app-title' }, [
        el('span', { className: 'app-title__mark', text: '29N', attrs: { 'aria-hidden': 'true' } }),
        el('span', { className: 'app-title__name', text: APP_NAME }),
      ]),
      el('p', {
        className: 'app-subtitle',
        text: 'Independiente · Sin registro · Tus respuestas no salen de tu navegador',
      }),
    ]),
  ]);
  const status = el('div', {
    className: 'visually-hidden',
    attrs: { id: 'app-status', role: 'status', 'aria-live': 'polite' },
  });
  const viewRoot = el('main', { className: 'app-view', attrs: { id: 'app-view' } });
  container.append(header, status, viewRoot);

  const topicById = new Map(data.topics.map((topic) => [topic.id, topic]));
  const total = data.questions.length;
  let state: QuestionnaireState = createInitialState();
  let screen: ResultScreen = 'results';
  let territoryError: string | null = null;

  function announce(message: string): void {
    status.textContent = message;
  }

  function render(): void {
    viewRoot.textContent = '';

    if (state.step === 'intro') {
      viewRoot.append(
        renderIntroView({
          territories: data.territories,
          selectedId: state.territoryId,
          error: territoryError,
          topics: data.topics,
          questionCount: total,
          priorityTopicIds: state.priorityTopicIds,
          handlers: {
            onSelect: (territoryId) => {
              state = selectTerritory(state, territoryId);
              territoryError = null;
              const errorNode = viewRoot.querySelector<HTMLElement>('#territory-error');
              if (errorNode) errorNode.hidden = true;
            },
            onTogglePriorityTopic: (topicId) => {
              state = togglePriorityTopic(state, topicId);
              announce(
                `Has marcado ${state.priorityTopicIds.length} de ${MAX_PRIORITY_TOPICS} temas prioritarios.`,
              );
            },
            onSubmit: () => {
              if (state.territoryId === null) {
                territoryError = 'Selecciona tu comunidad autónoma para continuar.';
                render();
                return;
              }
              state = startQuestionnaire(state);
              announce('Cuestionario iniciado.');
              render();
            },
          },
        }),
      );
    } else if (state.step === 'questions') {
      const question = currentQuestion(state, data.questions);
      if (question === null) {
        state = { ...state, step: 'done' };
        render();
        return;
      }

      const advance = (next: QuestionnaireState, message: string): void => {
        state = next;
        announce(
          state.step === 'done' ? 'Cuestionario completado.' : `${message} Pregunta ${state.currentIndex + 1} de ${total}.`,
        );
        render();
      };

      viewRoot.append(
        renderQuestionView({
          question,
          topicName: topicById.get(question.topicId)?.name ?? null,
          priority: state.priorityTopicIds.includes(question.topicId),
          index: state.currentIndex,
          total,
          answered: answeredCount(state),
          selectedValue: getAnswer(state, question.id),
          handlers: {
            onAnswer: (value) => {
              state = setAnswer(state, question.id, value);
              const counter = viewRoot.querySelector<HTMLElement>('.progress__answered');
              if (counter) counter.textContent = `${answeredCount(state)} respondidas`;
            },
            onPrevious: () => advance(goPrevious(state), ''),
            onSkip: () => advance(skipCurrent(state, data.questions), 'Propuesta omitida.'),
            onSubmit: () => advance(goNext(state, total), ''),
          },
        }),
      );
    } else if (screen === 'methodology') {
      viewRoot.append(
        renderMethodologyView(data, {
          onBackToResults: () => {
            screen = 'results';
            announce('Resultados.');
            render();
          },
        }),
      );
    } else {
      const results = computeResults(data, {
        territoryId: state.territoryId ?? '',
        answers: collectAnswers(state, data.questions),
      });
      viewRoot.append(
        renderResultsView({
          data,
          results,
          updatedAt: data.meta.updatedAt,
          handlers: {
            onRestart: () => {
              state = createInitialState();
              territoryError = null;
              screen = 'results';
              announce('Cuestionario reiniciado.');
              render();
            },
            onReview: () => {
              state = goToQuestion(state, 0, total);
              announce(`Revisando respuestas. Pregunta 1 de ${total}.`);
              render();
            },
            onShowMethodology: () => {
              screen = 'methodology';
              announce('Metodología.');
              render();
            },
          },
        }),
      );
    }

    if (state.step === 'intro' && territoryError !== null) {
      viewRoot.querySelector<HTMLSelectElement>('#territory-select')?.focus();
    } else {
      viewRoot.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true });
    }
    if (typeof window.scrollTo === 'function') {
      try {
        window.scrollTo({ top: 0 });
      } catch {
        // Entornos sin layout (tests) no implementan scrollTo.
      }
    }
  }

  render();
}
