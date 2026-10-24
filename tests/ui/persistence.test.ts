// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';

import { loadData } from '../../src/data/load';
import { loadProgress, PROGRESS_TTL_MS, saveProgress } from '../../src/ui/persistence';
import { createInitialState } from '../../src/ui/state';

const data = loadData();
const [first, second] = data.questions;

describe('persistencia del progreso', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('no guarda nada mientras el estado sigue vacío', () => {
    saveProgress(createInitialState());
    expect(loadProgress(data)).toBeNull();
  });

  it('descarta el progreso caducado', () => {
    saveProgress({ ...createInitialState(), territoryId: 'madrid' }, 0);
    expect(loadProgress(data, PROGRESS_TTL_MS + 1)).toBeNull();
    expect(localStorage.length).toBe(0);
  });

  it('descarta respuestas, temas y territorios que ya no existen', () => {
    saveProgress(
      {
        step: 'done',
        territoryId: 'madrid',
        currentIndex: 999,
        answers: { [first?.id ?? '']: 1, [second?.id ?? '']: 7, retirada: 1 },
        priorityTopicIds: ['inexistente', data.topics[0]?.id ?? ''],
      },
      0,
    );
    const restored = loadProgress(data, 1);
    expect(restored?.step).toBe('done');
    expect(restored?.currentIndex).toBe(data.questions.length - 1);
    expect(restored?.answers).toEqual({ [first?.id ?? '']: 1 });
    expect(restored?.priorityTopicIds).toEqual([data.topics[0]?.id]);
  });

  it('vuelve a la portada si el territorio guardado no es válido', () => {
    saveProgress({ ...createInitialState(), step: 'questions', territoryId: 'atlantida' }, 0);
    expect(loadProgress(data, 1)?.step).toBe('intro');
  });

  it('ignora datos corruptos', () => {
    localStorage.setItem('questionnaire-progress', '{no es json');
    expect(loadProgress(data)).toBeNull();
    expect(localStorage.length).toBe(0);
  });
});
