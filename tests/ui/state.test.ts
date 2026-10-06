import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  answeredCount,
  clearAnswer,
  confirmTerritory,
  createInitialState,
  currentQuestion,
  getAnswer,
  goNext,
  goPrevious,
  isAnswered,
  MAX_PRIORITY_TOPICS,
  selectTerritory,
  setAnswer,
  skipCurrent,
  togglePriorityTopic,
} from '../../src/ui/state';

const questions = [{ id: 'q-a' }, { id: 'q-b' }, { id: 'q-c' }];

function startedState() {
  return confirmTerritory(selectTerritory(createInitialState(), 'madrid'));
}

describe('máquina de estados del cuestionario', () => {
  it('empieza en el paso de territorio sin respuestas ni temas prioritarios', () => {
    const state = createInitialState();
    expect(state.step).toBe('territory');
    expect(state.territoryId).toBeNull();
    expect(state.currentIndex).toBe(0);
    expect(state.answers).toEqual({});
    expect(state.priorityTopicIds).toEqual([]);
  });

  it('no avanza al cuestionario sin territorio seleccionado', () => {
    const state = confirmTerritory(createInitialState());
    expect(state.step).toBe('territory');
  });

  it('trata el placeholder vacío como ausencia de territorio', () => {
    const state = selectTerritory(createInitialState(), '');
    expect(state.territoryId).toBeNull();
    expect(confirmTerritory(state).step).toBe('territory');
  });

  it('vuelve a bloquear el avance si se deselecciona una comunidad ya elegida', () => {
    const state = selectTerritory(selectTerritory(createInitialState(), 'cataluna'), '');
    expect(state.territoryId).toBeNull();
    expect(confirmTerritory(state).step).toBe('territory');
  });

  it('avanza al cuestionario tras confirmar el territorio', () => {
    const state = startedState();
    expect(state.step).toBe('questions');
    expect(state.currentIndex).toBe(0);
    expect(state.territoryId).toBe('madrid');
  });

  it('guarda la respuesta por pregunta', () => {
    let state = startedState();
    state = setAnswer(state, 'q-a', ['op1']);

    expect(getAnswer(state, 'q-a')).toEqual({ optionIds: ['op1'] });
    expect(isAnswered(state, 'q-a')).toBe(true);
    expect(answeredCount(state)).toBe(1);
  });

  it('marca, desmarca y limita los temas prioritarios a tres', () => {
    let state = startedState();
    state = togglePriorityTopic(state, 'tema-1');
    state = togglePriorityTopic(state, 'tema-2');
    state = togglePriorityTopic(state, 'tema-3');

    expect(state.priorityTopicIds).toEqual(['tema-1', 'tema-2', 'tema-3']);

    const capped = togglePriorityTopic(state, 'tema-4');
    expect(capped).toBe(state);
    expect(capped.priorityTopicIds).toEqual(['tema-1', 'tema-2', 'tema-3']);
    expect(capped.priorityTopicIds.length).toBeLessThanOrEqual(MAX_PRIORITY_TOPICS);

    const unmarked = togglePriorityTopic(state, 'tema-2');
    expect(unmarked).not.toBe(state);
    expect(unmarked.priorityTopicIds).toEqual(['tema-1', 'tema-3']);
  });

  it('no muta el estado al cambiar los temas prioritarios', () => {
    const initial = createInitialState();
    const withTopic = togglePriorityTopic(initial, 'tema-1');

    expect(initial.priorityTopicIds).toEqual([]);
    expect(withTopic.priorityTopicIds).toEqual(['tema-1']);
  });

  it('conserva los temas prioritarios al confirmar el territorio', () => {
    let state = togglePriorityTopic(createInitialState(), 'tema-1');
    state = selectTerritory(state, 'madrid');
    state = confirmTerritory(state);

    expect(state.step).toBe('questions');
    expect(state.priorityTopicIds).toEqual(['tema-1']);
  });

  it('no muta el estado anterior', () => {
    const initial = createInitialState();
    const withTerritory = selectTerritory(initial, 'galicia');
    const withAnswer = setAnswer(initial, 'q-a', ['op1']);

    expect(initial.territoryId).toBeNull();
    expect(initial.answers).toEqual({});
    expect(withTerritory.territoryId).toBe('galicia');
    expect(withAnswer.answers).toEqual({ 'q-a': { optionIds: ['op1'] } });
  });

  it('avanza y retrocede conservando las respuestas', () => {
    let state = startedState();
    state = setAnswer(state, 'q-a', ['op1']);
    state = goNext(state, questions.length);
    expect(currentQuestion(state, questions)?.id).toBe('q-b');

    state = setAnswer(state, 'q-b', ['op2', 'op3']);
    state = goPrevious(state);

    expect(currentQuestion(state, questions)?.id).toBe('q-a');
    expect(getAnswer(state, 'q-a')?.optionIds).toEqual(['op1']);
    expect(getAnswer(state, 'q-b')?.optionIds).toEqual(['op2', 'op3']);
  });

  it('omitir borra la respuesta previa y avanza', () => {
    let state = startedState();
    state = setAnswer(state, 'q-a', ['op1']);
    state = skipCurrent(state, questions);

    expect(getAnswer(state, 'q-a')).toBeUndefined();
    expect(currentQuestion(state, questions)?.id).toBe('q-b');
  });

  it('finaliza tras la última pregunta', () => {
    let state = startedState();
    state = goNext(state, questions.length);
    state = goNext(state, questions.length);
    state = goNext(state, questions.length);

    expect(state.step).toBe('done');
  });

  it('no retrocede más allá de la primera pregunta ni avanza fuera del cuestionario', () => {
    const state = startedState();
    expect(goPrevious(state).currentIndex).toBe(0);
    expect(goNext(createInitialState(), questions.length).step).toBe('territory');
  });

  it('limpiar una respuesta inexistente no cambia el estado', () => {
    const state = startedState();
    expect(clearAnswer(state, 'q-z')).toBe(state);
  });

  it('mantiene todo el estado en memoria, sin almacenamiento persistente', () => {
    const first = createInitialState();
    const second = createInitialState();
    expect(first).not.toBe(second);
    expect(first.answers).not.toBe(second.answers);

    const source = readFileSync(new URL('../../src/ui/state.ts', import.meta.url), 'utf8');
    expect(source).not.toMatch(/localStorage|sessionStorage/);
  });
});
