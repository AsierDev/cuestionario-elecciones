export type QuestionnaireStep = 'territory' | 'questions' | 'done';

export const MAX_PRIORITY_TOPICS = 3;

export interface QuestionAnswer {
  optionIds: string[];
}

export interface QuestionnaireState {
  step: QuestionnaireStep;
  territoryId: string | null;
  currentIndex: number;
  answers: Record<string, QuestionAnswer>;
  priorityTopicIds: string[];
}

export function createInitialState(): QuestionnaireState {
  return {
    step: 'territory',
    territoryId: null,
    currentIndex: 0,
    answers: {},
    priorityTopicIds: [],
  };
}

export function selectTerritory(
  state: QuestionnaireState,
  territoryId: string,
): QuestionnaireState {
  return { ...state, territoryId: territoryId === '' ? null : territoryId };
}

export function confirmTerritory(state: QuestionnaireState): QuestionnaireState {
  if (state.territoryId === null) return state;
  return { ...state, step: 'questions', currentIndex: 0 };
}

export function getAnswer(
  state: QuestionnaireState,
  questionId: string,
): QuestionAnswer | undefined {
  return state.answers[questionId];
}

export function isAnswered(state: QuestionnaireState, questionId: string): boolean {
  return (state.answers[questionId]?.optionIds.length ?? 0) > 0;
}

export function answeredCount(state: QuestionnaireState): number {
  return Object.values(state.answers).filter((answer) => answer.optionIds.length > 0).length;
}

export function setAnswer(
  state: QuestionnaireState,
  questionId: string,
  optionIds: string[],
): QuestionnaireState {
  return {
    ...state,
    answers: {
      ...state.answers,
      [questionId]: { optionIds: [...optionIds] },
    },
  };
}

export function togglePriorityTopic(
  state: QuestionnaireState,
  topicId: string,
): QuestionnaireState {
  if (state.priorityTopicIds.includes(topicId)) {
    return { ...state, priorityTopicIds: state.priorityTopicIds.filter((id) => id !== topicId) };
  }
  if (state.priorityTopicIds.length >= MAX_PRIORITY_TOPICS) return state;
  return { ...state, priorityTopicIds: [...state.priorityTopicIds, topicId] };
}

export function clearAnswer(state: QuestionnaireState, questionId: string): QuestionnaireState {
  if (!(questionId in state.answers)) return state;
  const answers = { ...state.answers };
  delete answers[questionId];
  return { ...state, answers };
}

export function currentQuestion<T extends { id: string }>(
  state: QuestionnaireState,
  questions: T[],
): T | null {
  if (state.step !== 'questions') return null;
  return questions[state.currentIndex] ?? null;
}

export function goNext(state: QuestionnaireState, questionCount: number): QuestionnaireState {
  if (state.step !== 'questions') return state;
  const nextIndex = state.currentIndex + 1;
  if (nextIndex >= questionCount) return { ...state, step: 'done' };
  return { ...state, currentIndex: nextIndex };
}

export function goPrevious(state: QuestionnaireState): QuestionnaireState {
  if (state.step !== 'questions' || state.currentIndex === 0) return state;
  return { ...state, currentIndex: state.currentIndex - 1 };
}

export function skipCurrent<T extends { id: string }>(
  state: QuestionnaireState,
  questions: T[],
): QuestionnaireState {
  const question = currentQuestion(state, questions);
  const cleared = question ? clearAnswer(state, question.id) : state;
  return goNext(cleared, questions.length);
}
