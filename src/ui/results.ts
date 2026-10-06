import { ANSWER_SCALE, nearestScalePoint, SCORING_CONFIG } from '../core/config';
import {
  summarizeAgreement,
  type PartyScore,
  type QuestionComparison,
  type QuestionResult,
  type ScoringResults,
  type TopicResult,
} from '../core/scoring';
import type { DataBundle, Party } from '../data/schema';

import { createButton, el } from './components';
import { formatDate, formatList, formatPercent } from './format';

export interface ResultsViewHandlers {
  onRestart: () => void;
  onReview: () => void;
  onShowMethodology: () => void;
}

export interface ResultsViewParams {
  data: DataBundle;
  results: ScoringResults;
  updatedAt: string;
  handlers: ResultsViewHandlers;
}

const SOURCE_TYPE_LABEL: Record<string, string> = {
  'programa-2026': 'Programa 2026',
  'programa-2023': 'Programa 2023',
  declaracion: 'Declaración o documento oficial',
  votacion: 'Votación parlamentaria',
};

function externalLink(label: string, href: string, className: string): HTMLAnchorElement {
  return el(
    'a',
    { className, attrs: { href, target: '_blank', rel: 'noopener noreferrer' } },
    [label, el('span', { className: 'visually-hidden', text: ' (abre en una pestaña nueva)' })],
  );
}

function section(
  id: string,
  title: string,
  lead: string | null,
  children: (Node | string)[],
): HTMLElement {
  const content: (Node | string)[] = [
    el('h3', { className: 'section-title', text: title, attrs: { id: `${id}-heading` } }),
  ];
  if (lead) content.push(el('p', { className: 'section-lead', text: lead }));
  return el(
    'section',
    { className: 'results-section', attrs: { id, 'aria-labelledby': `${id}-heading` } },
    [...content, ...children],
  );
}

function bar(value: number): HTMLElement {
  const fill = el('span', { className: 'bar__fill' });
  fill.style.width = `${Math.round(value * 100)}%`;
  return el('span', { className: 'bar', attrs: { 'aria-hidden': 'true' } }, [fill]);
}

function stanceLabel(value: number): string {
  return nearestScalePoint(value).label;
}

function renderComparison(item: QuestionComparison, partyName: string): HTMLElement {
  const sourceLabel = SOURCE_TYPE_LABEL[item.position.sourceType] ?? item.position.sourceType;
  const children: (Node | string)[] = [
    el('p', { className: 'comparison__title', text: item.question.title }),
    el('p', { className: 'comparison__stances' }, [
      el('span', { className: 'comparison__you', text: `Tú: ${stanceLabel(item.userValue)}` }),
      el('span', {
        className: 'comparison__party',
        text: `${partyName}: ${stanceLabel(item.partyValue)}`,
      }),
    ]),
  ];
  if (item.position.note) {
    children.push(el('p', { className: 'comparison__note', text: item.position.note }));
  }
  children.push(
    el('p', { className: 'comparison__source' }, [
      externalLink(
        `${sourceLabel} · ${formatDate(item.position.sourceDate)}`,
        item.position.sourceUrl,
        'source-link',
      ),
    ]),
  );
  return el('li', { className: 'comparison' }, children);
}

function renderAgreementColumn(
  title: string,
  items: QuestionComparison[],
  partyName: string,
  empty: string,
  modifier: string,
): HTMLElement {
  const content: (Node | string)[] = [el('h4', { className: 'agreement__title', text: title })];
  if (items.length === 0) {
    content.push(el('p', { className: 'agreement__empty', text: empty }));
  } else {
    content.push(
      el(
        'ul',
        { className: 'agreement__list' },
        items.map((item) => renderComparison(item, partyName)),
      ),
    );
  }
  return el('div', { className: `agreement agreement--${modifier}` }, content);
}

function coverageSentence(score: PartyScore): string {
  const base = `Comparado en ${score.comparedCount} de tus ${score.answeredCount} respuestas`;
  if (score.comparedCount === score.answeredCount) return `${base}.`;
  return `${base} (${formatPercent(score.coverage ?? 0)} del peso). En el resto no tiene una posición documentada.`;
}

function renderPartyRow(
  score: PartyScore,
  rank: number | null,
  questionTitleById: Map<string, string>,
): HTMLElement {
  const name = score.party.displayName;
  const summary = el('summary', { className: 'party-row__summary' }, [
    el('span', {
      className: 'party-row__rank',
      text: rank === null ? '·' : String(rank),
      attrs: { 'aria-hidden': 'true' },
    }),
    el('span', { className: 'party-row__name', text: name }),
    bar(score.affinity ?? 0),
    el('span', { className: 'party-row__value', text: formatPercent(score.affinity ?? 0) }),
  ]);

  const { agreements, disagreements } = summarizeAgreement(score);
  const body = el('div', { className: 'party-row__body' }, [
    el('p', { className: 'party-row__coverage', text: coverageSentence(score) }),
    el('div', { className: 'agreement-grid' }, [
      renderAgreementColumn(
        'Donde más coincidís',
        agreements,
        name,
        'No hay ninguna propuesta en la que coincidáis claramente.',
        'match',
      ),
      renderAgreementColumn(
        'Donde más discrepáis',
        disagreements,
        name,
        'No hay ninguna propuesta en la que discrepéis claramente.',
        'mismatch',
      ),
    ]),
  ]);

  if (score.missingQuestionIds.length > 0) {
    const titles = score.missingQuestionIds.map((id) => questionTitleById.get(id) ?? id);
    body.append(
      el('p', {
        className: 'party-row__missing',
        text: `Sin posición documentada en: ${titles.join(' · ')}.`,
      }),
    );
  }
  body.append(
    externalLink(`Programa electoral (${score.party.programYear})`, score.party.programUrl, 'program-link'),
  );

  return el('li', { className: 'party-row' }, [
    el('details', { className: 'party-row__details' }, [summary, body]),
  ]);
}

function heroSummary(eligible: PartyScore[]): { title: string; lead: string } {
  const top = eligible[0];
  if (!top || top.affinity === null) {
    return {
      title: 'Tus resultados',
      lead: 'Ningún partido tiene suficientes posiciones documentadas en tus respuestas para establecer un ranking fiable.',
    };
  }
  // Empate según lo que se muestra: dos partidos con el mismo porcentaje redondeado se nombran juntos.
  const topLabel = formatPercent(top.affinity);
  const tied = eligible.filter((score) => formatPercent(score.affinity ?? 0) === topLabel);
  const names = formatList(tied.map((score) => score.party.displayName));
  const rest = eligible
    .slice(tied.length, tied.length + 2)
    .map((score) => `${score.party.displayName} (${formatPercent(score.affinity ?? 0)})`);
  const lead =
    rest.length > 0
      ? `Tu afinidad más alta es del ${formatPercent(top.affinity)}. Le ${rest.length > 1 ? 'siguen' : 'sigue'} ${formatList(rest)}.`
      : `Tu afinidad más alta es del ${formatPercent(top.affinity)}.`;
  return { title: `Coincides más con ${names}`, lead };
}

function renderTopicTable(topics: TopicResult[], parties: Party[]): HTMLElement {
  const headRow = el('tr', {}, [
    el('th', { className: 'heatmap__corner', text: 'Tema', attrs: { scope: 'col' } }),
    ...parties.map((party) =>
      el('th', { className: 'heatmap__party', text: party.displayName, attrs: { scope: 'col' } }),
    ),
  ]);

  const body = el('tbody');
  for (const topic of topics) {
    const label = el('th', { className: 'heatmap__topic', attrs: { scope: 'row' } }, [
      el('span', { text: topic.topic.name }),
    ]);
    if (topic.priority) {
      label.append(el('span', { className: 'badge badge--small', text: 'Prioritario' }));
    }
    label.append(
      el('span', {
        className: 'heatmap__count',
        text: `${topic.answeredCount} ${topic.answeredCount === 1 ? 'respuesta' : 'respuestas'}`,
      }),
    );
    const row = el('tr', {}, [label]);
    for (const party of parties) {
      const cell = topic.parties.find((item) => item.party.id === party.id);
      const affinity = cell?.affinity ?? null;
      const isBest = affinity !== null && topic.winners.some((winner) => winner.id === party.id);
      // La afinidad rara vez baja del 25 %: se reescala para que la diferencia de tono sea visible.
      const level = affinity === null ? 0 : Math.min(1, Math.max(0, (affinity - 0.25) / 0.75));
      const td = el('td', {
        className: `heatmap__cell${affinity === null ? ' heatmap__cell--empty' : ''}${isBest ? ' heatmap__cell--best' : ''}${level > 0.55 ? ' heatmap__cell--dark' : ''}`,
        text: affinity === null ? '—' : formatPercent(affinity),
        attrs: {
          title:
            affinity === null
              ? `${party.displayName}: sin posición documentada en este tema`
              : `${party.displayName}: ${formatPercent(affinity)} en ${topic.topic.name}`,
        },
      });
      if (affinity !== null) td.style.setProperty('--level', level.toFixed(3));
      row.append(td);
    }
    body.append(row);
  }

  return el('div', { className: 'table-scroll', attrs: { tabindex: '0', role: 'region', 'aria-label': 'Tabla de afinidad por temas' } }, [
    el('table', { className: 'heatmap' }, [
      el('caption', {
        className: 'visually-hidden',
        text: 'Afinidad con cada partido en cada tema. Un guion indica que no hay posición documentada.',
      }),
      el('thead', {}, [headRow]),
      body,
    ]),
  ]);
}

function renderSpectrum(result: QuestionResult): HTMLElement {
  const columns = ANSWER_SCALE.map((point) => {
    const parties = result.stances
      .filter((stance) => stance.value !== null && nearestScalePoint(stance.value).value === point.value)
      .map((stance) => stance.party);
    const isUser = result.userValue === point.value;
    const items: HTMLElement[] = [];
    if (isUser) items.push(el('li', { className: 'pill pill--you', text: 'Tú' }));
    for (const party of parties) {
      items.push(el('li', { className: 'pill', text: party.displayName }));
    }
    return el('div', { className: `spectrum__col${isUser ? ' spectrum__col--you' : ''}` }, [
      el('p', { className: 'spectrum__label', text: point.shortLabel }),
      el('ul', { className: 'spectrum__items', attrs: { 'aria-label': point.label } }, items),
    ]);
  });
  return el('div', { className: 'spectrum' }, columns);
}

function renderProposal(result: QuestionResult): HTMLElement {
  const item = el('li', { className: 'proposal' }, [
    el('div', { className: 'proposal__head' }, [
      el('p', { className: 'proposal__title', text: result.question.title }),
      el('p', { className: 'proposal__statement', text: result.question.statement }),
    ]),
    renderSpectrum(result),
  ]);

  const footer: string[] = [];
  if (result.winners.length > 0) {
    footer.push(
      `Más cerca de tu respuesta: ${formatList(result.winners.map((party) => party.displayName))}.`,
    );
  }
  const missing = result.stances.filter((stance) => stance.value === null).map((s) => s.party.displayName);
  if (missing.length > 0) footer.push(`Sin posición documentada: ${formatList(missing)}.`);
  if (footer.length > 0) {
    item.append(el('p', { className: 'proposal__footer', text: footer.join(' ') }));
  }
  return item;
}

function renderProposals(results: ScoringResults, data: DataBundle): HTMLElement[] {
  const groups: HTMLElement[] = [];
  for (const topic of data.topics) {
    const inTopic = results.questions.filter((result) => result.question.topicId === topic.id);
    if (inTopic.length === 0) continue;
    groups.push(
      el('div', { className: 'proposal-group' }, [
        el('h4', { className: 'proposal-group__title', text: topic.name }),
        el('ol', { className: 'proposals' }, inTopic.map(renderProposal)),
      ]),
    );
  }
  return groups;
}

function renderActions(handlers: ResultsViewHandlers): HTMLElement {
  const review = createButton({ label: 'Revisar mis respuestas', variant: 'secondary', action: 'review' });
  review.addEventListener('click', () => handlers.onReview());
  const methodology = createButton({ label: 'Cómo se calcula', variant: 'secondary', action: 'methodology' });
  methodology.addEventListener('click', () => handlers.onShowMethodology());
  const restart = createButton({ label: 'Volver a empezar', variant: 'ghost', action: 'restart' });
  restart.addEventListener('click', () => handlers.onRestart());
  return el('div', { className: 'actions actions--results' }, [review, methodology, restart]);
}

export function renderResultsView(params: ResultsViewParams): HTMLElement {
  const { data, results, updatedAt, handlers } = params;
  const questionTitleById = new Map(data.questions.map((question) => [question.id, question.title]));
  const view = (children: (Node | string)[]): HTMLElement =>
    el('section', { className: 'view view--results', attrs: { 'aria-labelledby': 'results-heading' } }, children);

  if (!results.hasAnswers) {
    return view([
      el('h2', { className: 'view__title', text: 'Resultados', attrs: { id: 'results-heading', tabindex: '-1' } }),
      el('p', {
        className: 'lead',
        text: 'No has respondido ninguna propuesta. Vuelve al cuestionario y responde al menos una para ver tu afinidad.',
      }),
      renderActions(handlers),
    ]);
  }

  const eligible = results.ranking.filter((score) => score.eligible);
  const hero = results.partialComparison
    ? {
        title: 'Comparación parcial',
        lead: `Has respondido ${results.answeredCount} de ${data.questions.length} propuestas. Hacen falta al menos ${SCORING_CONFIG.minComparedQuestions} para ordenar a los partidos con fiabilidad, pero ya puedes ver dónde te sitúas en cada una.`,
      }
    : heroSummary(eligible);

  const notices: HTMLElement[] = [
    el('p', {
      className: 'notice',
      attrs: { role: 'note', id: 'results-affinity-notice' },
      text: 'El porcentaje mide la cercanía entre tus respuestas y las posiciones documentadas de cada partido en estas propuestas: 100 % es la misma posición y 0 %, la contraria. No es una predicción de voto ni el porcentaje de un programa que compartes.',
    }),
  ];
  if (results.provisional) {
    notices.push(
      el('p', {
        className: 'notice notice--warning',
        attrs: { role: 'note' },
        text: 'Algunos partidos aún no han publicado su programa de 2026; sus posiciones se documentan con votaciones, programas y declaraciones anteriores.',
      }),
    );
  }

  const nav = el('nav', { className: 'results-nav', attrs: { 'aria-label': 'Secciones de resultados' } }, [
    el('a', { text: 'Partidos', attrs: { href: '#partidos' } }),
    el('a', { text: 'Temas', attrs: { href: '#temas' } }),
    el('a', { text: 'Propuestas', attrs: { href: '#propuestas' } }),
  ]);

  const children: (Node | string)[] = [
    el('header', { className: 'results-hero' }, [
      el('p', {
        className: 'eyebrow',
        text: `Tu resultado · ${results.answeredCount} de ${data.questions.length} propuestas respondidas`,
      }),
      el('h2', { className: 'results-hero__title', text: hero.title, attrs: { id: 'results-heading', tabindex: '-1' } }),
      el('p', { className: 'results-hero__lead', text: hero.lead }),
      ...notices,
      nav,
    ]),
  ];

  if (!results.partialComparison && eligible.length > 0) {
    children.push(
      section(
        'partidos',
        'Afinidad con cada partido',
        `Despliega cada partido para ver en qué propuestas coincidís y discrepáis más, con la fuente de su posición. Solo entran en el ranking los partidos comparados en al menos ${SCORING_CONFIG.minComparedQuestions} respuestas y en el ${formatPercent(SCORING_CONFIG.minCoverage)} del peso.`,
        [
          el(
            'ol',
            { className: 'ranking' },
            eligible.map((score, index) => renderPartyRow(score, index + 1, questionTitleById)),
          ),
        ],
      ),
    );
  }

  if (results.lowCoverage.length > 0) {
    children.push(
      section(
        results.partialComparison || eligible.length === 0 ? 'partidos' : 'cobertura-insuficiente',
        'Comparación insuficiente',
        'Estos partidos tienen posición documentada solo en una parte de tus respuestas, así que no entran en el ranking. El porcentaje se muestra como referencia.',
        [
          el(
            'ul',
            { className: 'ranking ranking--muted low-coverage__list' },
            results.lowCoverage.map((score) => renderPartyRow(score, null, questionTitleById)),
          ),
        ],
      ),
    );
  }

  const others: HTMLElement[] = [];
  if (results.withoutData.length > 0) {
    others.push(
      el('p', {
        className: 'others__line',
        text: `Sin posiciones documentadas en tus respuestas: ${formatList(results.withoutData.map((s) => s.party.displayName))}.`,
      }),
    );
  }
  if (results.nonApplicableParties.length > 0) {
    others.push(
      el('p', {
        className: 'others__line',
        text: `No concurren en tu comunidad y no se comparan: ${formatList(results.nonApplicableParties.map((p) => p.displayName))}.`,
      }),
    );
  }
  if (others.length > 0) children.push(el('div', { className: 'others' }, others));

  if (results.topics.length > 0) {
    const scored = results.ranking.map((score) => score.party);
    const tableParties = [
      ...scored,
      ...results.applicableParties.filter((party) => !scored.some((p) => p.id === party.id)),
    ];
    const bestLines = results.topics
      .filter((topic) => topic.winners.length > 0)
      .map((topic) =>
        el('li', { className: 'topic-best__item' }, [
          el('span', { className: 'topic-best__topic', text: topic.topic.name }),
          el('span', {
            className: 'topic-best__party',
            text: `${formatList(topic.winners.map((p) => p.displayName))} · ${formatPercent(topic.bestAffinity ?? 0)}`,
          }),
        ]),
      );
    children.push(
      section(
        'temas',
        'Afinidad por temas',
        'Tu cercanía con cada partido agrupando las propuestas por tema. Cuanto más oscura es la celda, más coincidís. Un guion indica que el partido no tiene posición documentada en las propuestas que respondiste de ese tema.',
        [
          renderTopicTable(results.topics, tableParties),
          el('h4', { className: 'subsection-title', text: 'El partido más cercano en cada tema' }),
          el('ul', { className: 'topic-best' }, bestLines),
        ],
      ),
    );
  }

  children.push(
    section(
      'propuestas',
      'Propuesta a propuesta',
      'Dónde te sitúas tú y dónde se sitúa cada partido en la misma escala, de «muy en contra» a «muy a favor».',
      renderProposals(results, data),
    ),
  );

  children.push(renderActions(handlers));
  children.push(
    el('p', {
      className: 'updated-at',
      text: `Datos actualizados el ${formatDate(updatedAt)}. Cada posición enlaza a la fuente y fecha de su evidencia.`,
    }),
  );

  return view(children);
}
