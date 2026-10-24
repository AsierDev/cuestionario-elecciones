import { ANSWER_SCALE } from '../core/config';
import type { DataBundle } from '../data/schema';

import { createInitialState, MAX_PRIORITY_TOPICS, type QuestionnaireState } from './state';

const STORAGE_KEY = 'questionnaire-progress';
const STORAGE_VERSION = 1;

// Las respuestas son opiniones políticas: en un equipo compartido no deben quedarse indefinidamente.
export const PROGRESS_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface StoredProgress {
  version: number;
  savedAt: number;
  state: QuestionnaireState;
}

// El almacenamiento es una comodidad: si falla (modo privado, cuota, bloqueo), la app sigue sin él.
export function saveProgress(state: QuestionnaireState, now: number = Date.now()): void {
  try {
    if (state.step === 'intro' && state.territoryId === null && state.priorityTopicIds.length === 0) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    const stored: StoredProgress = { version: STORAGE_VERSION, savedAt: now, state };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // Sin almacenamiento disponible: el progreso no sobrevive a una recarga.
  }
}

export function clearProgress(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nada que borrar si el almacenamiento no está disponible.
  }
}

/**
 * Recupera el progreso guardado descartando lo que ya no encaje con los datos
 * actuales (preguntas, temas o territorios retirados en una actualización).
 */
export function loadProgress(data: DataBundle, now: number = Date.now()): QuestionnaireState | null {
  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (raw === null) return null;

  try {
    const stored = JSON.parse(raw) as Partial<StoredProgress>;
    if (stored.version !== STORAGE_VERSION || typeof stored.savedAt !== 'number') throw new Error();
    if (now - stored.savedAt > PROGRESS_TTL_MS) throw new Error();
    const saved = stored.state;
    if (!saved || typeof saved !== 'object') throw new Error();

    const territoryIds = new Set(data.territories.map((territory) => territory.id));
    const topicIds = new Set(data.topics.map((topic) => topic.id));
    const questionIds = new Set(data.questions.map((question) => question.id));
    const values = new Set(ANSWER_SCALE.map((point) => point.value));

    const territoryId =
      typeof saved.territoryId === 'string' && territoryIds.has(saved.territoryId)
        ? saved.territoryId
        : null;

    const answers: Record<string, number> = {};
    for (const [id, value] of Object.entries(saved.answers ?? {})) {
      if (questionIds.has(id) && values.has(value)) answers[id] = value;
    }

    const priorityTopicIds = (Array.isArray(saved.priorityTopicIds) ? saved.priorityTopicIds : [])
      .filter((id): id is string => typeof id === 'string' && topicIds.has(id))
      .slice(0, MAX_PRIORITY_TOPICS);

    const total = data.questions.length;
    const currentIndex = Number.isInteger(saved.currentIndex)
      ? Math.min(Math.max(saved.currentIndex, 0), total - 1)
      : 0;

    // Sin territorio válido no se puede seguir ni calcular resultados: vuelta a la portada.
    const step =
      territoryId !== null && (saved.step === 'questions' || saved.step === 'done')
        ? saved.step
        : 'intro';

    return { ...createInitialState(), step, territoryId, currentIndex, answers, priorityTopicIds };
  } catch {
    clearProgress();
    return null;
  }
}
