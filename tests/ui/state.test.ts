import { describe, expect, it } from 'vitest';

import {
  answeredCount,
  clearAnswer,
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
} from '../../src/ui/state';

const questions = [{ id: 'q1' }, { id: 'q2' }, { id: 'q3' }];

function started() {
  return startQuestionnaire(selectTerritory(createInitialState(), 'madrid'));
}

describe('estado del cuestionario', () => {
  it('empieza en la portada sin territorio ni respuestas', () => {
    const state = createInitialState();
    expect(state.step).toBe('intro');
    expect(state.territoryId).toBeNull();
    expect(answeredCount(state)).toBe(0);
  });

  it('no arranca sin territorio y trata el placeholder como vacío', () => {
    expect(startQuestionnaire(createInitialState()).step).toBe('intro');
    const cleared = selectTerritory(selectTerritory(createInitialState(), 'madrid'), '');
    expect(cleared.territoryId).toBeNull();
  });

  it('guarda, sobrescribe y borra respuestas sin mutar el estado', () => {
    const initial = started();
    const answered = setAnswer(initial, 'q1', 0.5);
    expect(getAnswer(initial, 'q1')).toBeUndefined();
    expect(getAnswer(setAnswer(answered, 'q1', -1), 'q1')).toBe(-1);
    expect(getAnswer(clearAnswer(answered, 'q1'), 'q1')).toBeUndefined();
  });

  it('conserva la posición neutral (0) como respuesta', () => {
    const state = setAnswer(started(), 'q1', 0);
    expect(getAnswer(state, 'q1')).toBe(0);
    expect(answeredCount(state)).toBe(1);
  });

  it('avanza, retrocede y termina en la última pregunta', () => {
    let state = started();
    expect(currentQuestion(state, questions)?.id).toBe('q1');
    state = goPrevious(state);
    expect(state.currentIndex).toBe(0);
    state = goNext(goNext(state, 3), 3);
    expect(currentQuestion(state, questions)?.id).toBe('q3');
    expect(goPrevious(state).currentIndex).toBe(1);
    expect(goNext(state, 3).step).toBe('done');
  });

  it('«Sin opinión» borra la respuesta previa y avanza', () => {
    const state = skipCurrent(setAnswer(started(), 'q1', 1), questions);
    expect(getAnswer(state, 'q1')).toBeUndefined();
    expect(state.currentIndex).toBe(1);
  });

  it('permite volver a una pregunta desde los resultados conservando respuestas', () => {
    const done = { ...setAnswer(started(), 'q2', 1), step: 'done' as const };
    const review = goToQuestion(done, 0, 3);
    expect(review.step).toBe('questions');
    expect(review.currentIndex).toBe(0);
    expect(getAnswer(review, 'q2')).toBe(1);
    expect(goToQuestion(done, 9, 3)).toBe(done);
  });

  it(`limita los temas prioritarios a ${MAX_PRIORITY_TOPICS}`, () => {
    let state = createInitialState();
    for (const id of ['a', 'b', 'c', 'd']) state = togglePriorityTopic(state, id);
    expect(state.priorityTopicIds).toEqual(['a', 'b', 'c']);
    expect(togglePriorityTopic(state, 'b').priorityTopicIds).toEqual(['a', 'c']);
  });
});
