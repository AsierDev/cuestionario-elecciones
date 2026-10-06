import { SCORING_CONFIG } from '../core/config';
import type { PartyScore, QuestionResult, ScoringResults } from '../core/scoring';
import type { DataBundle } from '../data/schema';

import { createButton, el } from './components';
import { formatDate, formatPercent } from './format';

export interface ResultsViewHandlers {
  onRestart: () => void;
  onShowMethodology: () => void;
}

export interface ResultsViewParams {
  data: DataBundle;
  results: ScoringResults;
  updatedAt: string;
  handlers: ResultsViewHandlers;
}

function externalLink(label: string, href: string, className: string): HTMLAnchorElement {
  return el(
    'a',
    {
      className,
      attrs: { href, target: '_blank', rel: 'noopener noreferrer' },
    },
    [label, el('span', { className: 'visually-hidden', text: ' (abre en una pestaña nueva)' })],
  );
}

function section(id: string, title: string, children: (Node | string)[]): HTMLElement {
  return el('section', { className: 'results-section', attrs: { 'aria-labelledby': id } }, [
    el('h3', { className: 'section-title', text: title, attrs: { id } }),
    ...children,
  ]);
}

function renderRankingItem(
  topicNameById: Map<string, string>,
  score: PartyScore,
  totalQuestions: number,
): HTMLElement {
  const item = el('li', { className: 'ranking__item' }, [
    el('div', { className: 'ranking__head' }, [
      el('span', { className: 'ranking__name', text: score.party.displayName }),
      el('span', { className: 'ranking__affinity', text: formatPercent(score.affinity ?? 0) }),
    ]),
    el('p', {
      className: 'ranking__meta',
      text: `Cobertura: ${formatPercent(score.coverage ?? 0)} · Comparadas: ${score.comparedCount} de ${totalQuestions} preguntas`,
    }),
  ]);

  if (score.missingTopicIds.length > 0) {
    const names = score.missingTopicIds.map((topicId) => topicNameById.get(topicId) ?? topicId);
    item.append(
      el('p', { className: 'ranking__missing', text: `Temas sin datos: ${names.join(', ')}.` }),
    );
  }

  item.append(
    externalLink(
      `Ver programa (${score.party.programYear})`,
      score.party.programUrl,
      'program-link',
    ),
  );
  return item;
}

function renderQuestionResult(result: QuestionResult): HTMLElement {
  const item = el('li', { className: 'winner' }, [
    el('p', { className: 'winner__question', text: result.question.text }),
  ]);

  const labelById = new Map(result.question.options.map((option) => [option.id, option.label]));
  if (result.userOptionIds.length > 0) {
    const labels = result.userOptionIds.map((id) => labelById.get(id) ?? id);
    item.append(el('p', { className: 'winner__answer', text: `Tu respuesta: ${labels.join(', ')}` }));
  }

  if (result.winners.length === 0) {
    item.append(
      el('p', {
        className: 'winner__empty',
        text: 'Sin datos suficientes en tu territorio para esta pregunta.',
      }),
    );
    return item;
  }

  if (result.bestAffinity !== null) {
    item.append(
      el('p', {
        className: 'winner__party',
        text: `Más afín: ${result.winners.map((party) => party.displayName).join(', ')} — ${formatPercent(result.bestAffinity)} de cercanía en esta pregunta`,
      }),
    );
  }
  return item;
}

function renderActions(handlers: ResultsViewHandlers): HTMLElement {
  const restart = createButton({ label: 'Volver a empezar', variant: 'primary', action: 'restart' });
  restart.addEventListener('click', () => handlers.onRestart());
  const methodology = createButton({
    label: 'Ver metodología',
    variant: 'secondary',
    action: 'methodology',
  });
  methodology.addEventListener('click', () => handlers.onShowMethodology());
  return el('div', { className: 'actions' }, [restart, methodology]);
}

export function renderResultsView(params: ResultsViewParams): HTMLElement {
  const { data, results, updatedAt, handlers } = params;
  const topicNameById = new Map(data.topics.map((topic) => [topic.id, topic.name]));

  const children: (Node | string)[] = [
    el('h2', {
      className: 'view__title',
      text: 'Resultados',
      attrs: { id: 'results-heading', tabindex: '-1' },
    }),
  ];

  if (!results.hasAnswers) {
    children.push(
      el('p', {
        className: 'lead',
        text: 'No has respondido ninguna pregunta. Vuelve a empezar y responde al menos una para ver tu afinidad.',
      }),
    );
    children.push(renderActions(handlers));
    return el(
      'section',
      { className: 'view view--results', attrs: { 'aria-labelledby': 'results-heading' } },
      children,
    );
  }

  children.push(
    el('p', {
      className: 'lead',
      text: `Has respondido ${results.answeredCount} de ${data.questions.length} preguntas.`,
    }),
  );

  if (results.provisional) {
    children.push(
      el('p', {
        className: 'notice notice--warning',
        attrs: { role: 'note' },
        text: 'Estos resultados se basan en datos provisionales: algunas posiciones aún no cuentan con programa electoral de 2026 y se documentan con fuentes anteriores.',
      }),
    );
  }

  children.push(
    el('p', {
      className: 'updated-at',
      text: `Datos actualizados el ${formatDate(updatedAt)}.`,
    }),
  );

  const eligibleRanking = results.ranking.filter((score) => score.eligible);

  if (results.partialComparison) {
    children.push(
      el('p', {
        className: 'notice',
        attrs: { role: 'note', id: 'results-partial-notice' },
        text: `Comparación parcial: has respondido menos de ${SCORING_CONFIG.minComparedQuestions} preguntas, así que ningún partido alcanza el mínimo de comparabilidad y no se muestra un ranking. Los partidos con datos aparecen bajo «Cobertura insuficiente».`,
      }),
    );
  } else if (eligibleRanking.length > 0) {
    const list = el('ol', { className: 'ranking' });
    for (const score of eligibleRanking) {
      list.append(renderRankingItem(topicNameById, score, data.questions.length));
    }
    children.push(
      section('results-ranking-heading', 'Ranking por afinidad', [
        el('p', {
          className: 'section-lead',
          text: `Afinidad media ponderada con los partidos que concurren en tu comunidad. Solo se incluyen los partidos con comparación suficiente (al menos ${SCORING_CONFIG.minComparedQuestions} preguntas comparadas y ${formatPercent(SCORING_CONFIG.minCoverage)} de cobertura ponderada). Ordenado de mayor a menor y, en caso de empate, alfabéticamente.`,
        }),
        list,
      ]),
    );
  }

  if (results.lowCoverage.length > 0) {
    const list = el('ul', { className: 'low-coverage__list' });
    for (const score of results.lowCoverage) {
      list.append(renderRankingItem(topicNameById, score, data.questions.length));
    }
    children.push(
      section('results-low-coverage-heading', 'Cobertura insuficiente', [
        el('p', {
          className: 'section-lead',
          text: `Estos partidos tienen posiciones documentadas en parte de tus respuestas, pero no alcanzan el mínimo de comparabilidad (al menos ${SCORING_CONFIG.minComparedQuestions} preguntas comparadas y ${formatPercent(SCORING_CONFIG.minCoverage)} de cobertura ponderada), así que no entran en el ranking. El porcentaje se muestra solo como referencia.`,
        }),
        list,
      ]),
    );
  }

  if (results.withoutData.length > 0) {
    const list = el('ul', { className: 'without-data__list' });
    for (const score of results.withoutData) {
      const item = el('li', { className: 'without-data__item', text: score.party.displayName });
      item.append(
        externalLink(
          `Ver programa (${score.party.programYear})`,
          score.party.programUrl,
          'program-link',
        ),
      );
      list.append(item);
    }
    children.push(
      section('results-without-data-heading', 'Sin datos suficientes', [
        el('p', {
          className: 'section-lead',
          text: 'No hay posiciones documentadas para ninguna de tus respuestas en estos partidos, así que no reciben porcentaje.',
        }),
        list,
      ]),
    );
  }

  if (results.nonApplicableParties.length > 0) {
    const list = el('ul', { className: 'non-applicable__list' });
    for (const party of results.nonApplicableParties) {
      list.append(el('li', { className: 'non-applicable__item', text: party.displayName }));
    }
    children.push(
      section('results-non-applicable-heading', 'Partidos que no concurren en tu comunidad', [
        el('p', {
          className: 'section-lead',
          text: 'No se puntúan porque no presentan candidatura votable en el territorio que elegiste.',
        }),
        list,
      ]),
    );
  }

  if (results.questions.length > 0) {
    const list = el('ol', { className: 'winners' });
    for (const result of results.questions) list.append(renderQuestionResult(result));
    children.push(
      section('results-winners-heading', 'Ganador por pregunta', [
        el('p', {
          className: 'section-lead',
          text: 'Partido o partidos más afines a tu respuesta en cada pregunta. La afinidad indicada es la máxima de la pregunta y la comparten todos los partidos empatados en cabeza. El porcentaje de cercanía va de 100 % (misma posición) a 0 % (extremos opuestos).',
        }),
        list,
      ]),
    );
  }

  children.push(renderActions(handlers));

  return el(
    'section',
    { className: 'view view--results', attrs: { 'aria-labelledby': 'results-heading' } },
    children,
  );
}
