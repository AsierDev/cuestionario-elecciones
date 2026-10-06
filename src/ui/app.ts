import { APP_NAME } from '../app/constants';
import { computeResults, type QuestionAnswer } from '../core/scoring';
import { loadData } from '../data/load';
import type { DataBundle, Question } from '../data/schema';

import { el } from './components';
import { renderMethodologyView } from './methodology';
import { renderQuestionView, renderTerritoryView } from './questionnaire';
import { renderResultsView } from './results';
import {
  confirmTerritory,
  createInitialState,
  currentQuestion,
  getAnswer,
  goNext,
  goPrevious,
  MAX_PRIORITY_TOPICS,
  selectTerritory,
  setAnswer,
  skipCurrent,
  togglePriorityTopic,
  type QuestionnaireState,
} from './state';

type ResultScreen = 'results' | 'methodology';

function collectAnswers(state: QuestionnaireState, questions: Question[]): QuestionAnswer[] {
  const answers: QuestionAnswer[] = [];
  const priorityTopicIds = new Set(state.priorityTopicIds);
  for (const question of questions) {
    const answer = getAnswer(state, question.id);
    if (answer && answer.optionIds.length > 0) {
      answers.push({
        questionId: question.id,
        optionIds: answer.optionIds,
        priority: priorityTopicIds.has(question.topicId),
      });
    }
  }
  return answers;
}

export function mountApp(container: HTMLElement, data: DataBundle = loadData()): void {
  container.textContent = '';

  const header = el('header', { className: 'app-header' }, [
    el('h1', { className: 'app-title', text: APP_NAME }),
    el('p', {
      className: 'app-subtitle',
      text: `Compara tus respuestas a ${data.questions.length} preguntas con las posiciones documentadas de los partidos incluidos. La aplicación no transmite ni almacena tus respuestas fuera del navegador.`,
    }),
  ]);
  const status = el('div', {
    className: 'visually-hidden',
    attrs: { id: 'app-status', role: 'status', 'aria-live': 'polite' },
  });
  const viewRoot = el('div', { className: 'app-view', attrs: { id: 'app-view' } });
  container.append(header, status, viewRoot);

  const topicNameById = new Map(data.topics.map((topic) => [topic.id, topic.name]));
  let state: QuestionnaireState = createInitialState();
  let screen: ResultScreen = 'results';
  let territoryError: string | null = null;

  function announce(message: string): void {
    status.textContent = message;
  }

  function render(): void {
    viewRoot.textContent = '';

    if (state.step === 'territory') {
      viewRoot.append(
        renderTerritoryView({
          territories: data.territories,
          selectedId: state.territoryId,
          error: territoryError,
          topics: data.topics,
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
                territoryError = 'Selecciona una comunidad autónoma para continuar.';
                render();
                return;
              }
              state = confirmTerritory(state);
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

      const index = state.currentIndex;
      const total = data.questions.length;
      const answer = getAnswer(state, question.id);

      viewRoot.append(
        renderQuestionView({
          question,
          topicName: topicNameById.get(question.topicId) ?? null,
          index,
          total,
          selectedOptionIds: answer?.optionIds ?? [],
          handlers: {
            onAnswer: (optionIds) => {
              state = setAnswer(state, question.id, optionIds);
            },
            onPrevious: () => {
              state = goPrevious(state);
              announce(`Pregunta ${state.currentIndex + 1} de ${total}`);
              render();
            },
            onSkip: () => {
              state = skipCurrent(state, data.questions);
              announce(
                state.step === 'done' ? 'Cuestionario completado.' : 'Pregunta omitida.',
              );
              render();
            },
            onSubmit: () => {
              state = goNext(state, total);
              announce(
                state.step === 'done'
                  ? 'Cuestionario completado.'
                  : `Pregunta ${state.currentIndex + 1} de ${total}`,
              );
              render();
            },
          },
        }),
      );
    } else {
      const results = computeResults(data, {
        territoryId: state.territoryId ?? '',
        answers: collectAnswers(state, data.questions),
      });

      if (screen === 'methodology') {
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
              onShowMethodology: () => {
                screen = 'methodology';
                announce('Metodología.');
                render();
              },
            },
          }),
        );
      }
    }

    if (state.step === 'territory' && territoryError !== null) {
      viewRoot.querySelector<HTMLSelectElement>('#territory-select')?.focus();
    } else {
      viewRoot.querySelector<HTMLElement>('h2')?.focus();
    }
  }

  render();
}
