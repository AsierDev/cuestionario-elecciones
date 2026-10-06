import { ANSWER_SCALE, SCORING_CONFIG } from '../core/config';
import type { DataBundle } from '../data/schema';

import { createButton, el } from './components';
import { formatDate, formatFactor, formatPercent } from './format';
import { MAX_PRIORITY_TOPICS } from './state';

export interface MethodologyViewHandlers {
  onBackToResults: () => void;
}

function section(id: string, title: string, children: (Node | string)[]): HTMLElement {
  return el('section', { className: 'results-section', attrs: { 'aria-labelledby': id } }, [
    el('h3', { className: 'section-title', text: title, attrs: { id } }),
    ...children,
  ]);
}

function partiesWithDeclarations(data: DataBundle): string[] {
  const partyIds = new Set<string>();
  for (const [partyId, rows] of Object.entries(data.positions)) {
    if (rows.some((row) => row.sourceType === 'declaracion')) partyIds.add(partyId);
  }
  return data.parties.filter((party) => partyIds.has(party.id)).map((party) => party.displayName);
}

function renderTopicCatalog(data: DataBundle): HTMLElement {
  const list = el('ol', { className: 'topics' });

  for (const topic of data.topics) {
    const item = el('li', { className: 'topic-item' }, [
      el('h4', { className: 'topic-item__name', text: topic.name }),
    ]);
    const evidenceList = el('ul', { className: 'evidence' });

    for (const evidence of topic.evidence) {
      const line = el('li', { className: 'evidence__item' }, [
        el('a', {
          className: 'evidence__link',
          text: evidence.sourceName,
          attrs: { href: evidence.sourceUrl, target: '_blank', rel: 'noopener noreferrer' },
        }),
      ]);
      const metaParts: string[] = [];
      if (evidence.metric) metaParts.push(evidence.metric);
      if (evidence.value !== undefined) {
        metaParts.push(`${String(evidence.value).replace('.', ',')} %`);
      }
      metaParts.push(formatDate(evidence.sourceDate));
      line.append(el('span', { className: 'evidence__meta', text: ` — ${metaParts.join(' · ')}` }));
      evidenceList.append(line);
    }

    item.append(evidenceList);
    list.append(item);
  }

  return section('methodology-topics-heading', 'Catálogo de temas y evidencias', [
    el('p', {
      className: 'section-lead',
      text: 'Temas incluidos y la evidencia de su relevancia (encuestas del CIS, agenda o programas electorales).',
    }),
    el('p', {
      className: 'section-lead',
      text: 'La relevancia de varios temas se apoya en el CIS, Estudio 3577 (septiembre de 2026). Es una fuente institucional que puede percibirse como sesgada; por eso la citamos con URL y fecha, la complementamos con agenda y programas, y no la usamos para estimar voto.',
    }),
    list,
  ]);
}

export function renderMethodologyView(
  data: DataBundle,
  handlers: MethodologyViewHandlers,
): HTMLElement {
  const declarations = partiesWithDeclarations(data);

  const declarationNote =
    declarations.length > 0
      ? `Cuando un partido no publicó programa propio para las generales, documentamos su posición con declaraciones oficiales y la marcamos con el tipo de fuente «declaración» (${declarations.join(' y ')}).`
      : 'Cuando un partido no publica programa propio para las generales, documentamos su posición con declaraciones oficiales y la marcamos con el tipo de fuente «declaración».';

  const children: (Node | string)[] = [
    el('h2', {
      className: 'view__title',
      text: 'Metodología',
      attrs: { id: 'methodology-heading', tabindex: '-1' },
    }),
    el('p', {
      className: 'lead',
      text: 'Cómo se calculan los resultados, de dónde sale cada dato y qué limitaciones tiene este buscador.',
    }),
    section('methodology-questions-heading', 'Cómo están hechas las preguntas', [
      el('p', {
        text: `Cada pregunta plantea una única medida concreta, de modo que no tengas que aceptar un paquete de medidas. Las ${data.questions.length} propuestas se agrupan en ${data.topics.length} temas y se eligieron porque los partidos discrepan sobre ellas y esa discrepancia está documentada (votaciones, programas o declaraciones oficiales).`,
      }),
      el('p', {
        text: 'Cada propuesta incluye la situación actual, qué cambiaría si se aplicara y qué implica estar a favor o en contra, siempre con sus costes en ambos sentidos. Durante el cuestionario no se muestra qué partido defiende cada medida.',
      }),
      el('p', {
        text: `Respondes en una escala común de cinco puntos: ${ANSWER_SCALE.map((point) => `«${point.label}» (${formatFactor(point.value)})`).join(', ')}. «Sin opinión» no cuenta; la posición central sí, como postura intermedia. Las posiciones de los partidos se codifican en esa misma escala.`,
      }),
    ]),
    section('methodology-formula-heading', 'Cómo se calcula la afinidad', [
      el('p', {
        text: 'En cada propuesta, la afinidad con un partido es la cercanía entre tu posición y la suya en la escala de −1 a +1:',
      }),
      el('p', {
        className: 'formula',
        text: 'afinidad = 1 − |tu posición − posición del partido| / 2',
      }),
      el('p', {
        text: `Va de 100 % (la misma posición) a 0 % (posiciones opuestas). Las propuestas de los temas que marques como prioritarios (hasta ${MAX_PRIORITY_TOPICS}) pesan ${formatFactor(SCORING_CONFIG.priorityFactor)} veces más.`,
      }),
      el('p', {
        text: 'La afinidad global con un partido es la media ponderada de las propuestas que respondiste y en las que el partido tiene posición documentada. La afinidad por tema aplica la misma media solo a las propuestas de ese tema. Los porcentajes se redondean al mostrarlos.',
      }),
      el('p', {
        text: '«Donde más coincidís» recoge las propuestas con afinidad igual o superior al 75 %, y «Donde más discrepáis», las que tienen un 50 % o menos: como mínimo, un punto completo de la escala de distancia.',
      }),
    ]),
    section('methodology-coverage-heading', 'Cobertura y datos faltantes', [
      el('p', {
        text: 'Si un partido no tiene posición documentada en un tema, esa pregunta se excluye de su media y reduce su cobertura; nunca se le asigna un valor inventado.',
      }),
      el('p', {
        text: 'Un partido sin ningún dato entre tus respuestas aparece sin porcentaje. Los partidos que no concurren en tu comunidad no se puntúan y se listan aparte.',
      }),
      el('p', {
        text: `El ranking principal solo incluye a los partidos con comparación suficiente: al menos ${SCORING_CONFIG.minComparedQuestions} preguntas comparadas y ${formatPercent(SCORING_CONFIG.minCoverage)} de cobertura ponderada. Los partidos con dato pero por debajo de esos umbrales aparecen bajo «Comparación insuficiente». Si respondes menos de ${SCORING_CONFIG.minComparedQuestions} preguntas, no se muestra ranking y se avisa de comparación parcial.`,
      }),
    ]),
    section('methodology-status-heading', 'Estados de los datos y actualización', [
      el('p', {
        text: 'Cada posición guarda su fuente, su fecha y un estado: «verificado» cuando procede de un programa o una fuente del ciclo de 2026, «provisional» cuando se apoya en evidencia anterior, y «sin datos suficientes» cuando la búsqueda no encontró una posición atribuible.',
      }),
      el('p', {
        text: `La fecha de última actualización del conjunto de datos aparece en los resultados («Conjunto de datos actualizado el ${formatDate(data.meta.updatedAt)}»). Actualizar posiciones solo requiere editar los ficheros de datos y volver a validarlos.`,
      }),
    ]),
    section('methodology-neutrality-heading', 'Criterios para reducir sesgos', [
      el('p', {
        text: 'Usamos la misma escala para todos los partidos y no empleamos colores, logos ni símbolos de partido. Todas las listas van en orden alfabético, salvo el ranking de resultados, que se ordena por afinidad de mayor a menor y, en caso de empate, alfabéticamente. Es la única excepción y está justificada por la finalidad del ranking.',
      }),
      el('p', {
        text: 'Los empates se muestran completos: si varios partidos comparten la máxima afinidad en una pregunta, aparecen todos, en orden alfabético.',
      }),
    ]),
    section('methodology-sources-heading', 'Origen de las posiciones', [
      el('p', {
        text: 'La mayoría de posiciones proceden de programas electorales, votaciones y documentos oficiales.',
      }),
      el('p', { text: declarationNote }),
      el('p', {
        text: 'Cuando hay una votación parlamentaria sobre la medida, se usa como evidencia principal: votar a favor se codifica como «a favor» (o «totalmente a favor» si el partido la impulsó), la abstención como posición intermedia y el voto en contra como «en contra». Los matices documentados (por ejemplo, votar en contra por motivos competenciales) se reflejan en la nota de cada posición.',
      }),
    ]),
    renderTopicCatalog(data),
    section('methodology-scope-heading', 'Alcance', [
      el('p', {
        text: 'Esta herramienta es informativa y orientativa. No es una predicción electoral ni una estimación de voto: mide la cercanía entre tus respuestas y las posiciones documentadas, nada más.',
      }),
      el('p', {
        text: 'La aplicación no transmite ni almacena tus respuestas fuera del navegador.',
      }),
    ]),
    section('methodology-rights-heading', 'Reutilización y derechos', [
      el('p', {
        text: 'Los datos del CIS se citan y enlazan a su publicación oficial; los programas y documentos de los partidos se enlazan, sin reproducir textos extensos. Este proyecto no usa logos ni marcas de partidos.',
      }),
      el('p', {
        text: 'El código de esta herramienta y los datos propios (preguntas, temas y posiciones recopiladas) no tienen una licencia de reutilización declarada; se publican con fines informativos y de verificación. Las fuentes externas (CIS, programas y documentos de partidos) mantienen sus propias condiciones de uso.',
      }),
    ]),
  ];

  const back = createButton({
    label: 'Volver a los resultados',
    variant: 'secondary',
    action: 'back',
  });
  back.addEventListener('click', () => handlers.onBackToResults());
  children.push(el('div', { className: 'actions' }, [back]));

  return el(
    'section',
    { className: 'view view--methodology', attrs: { 'aria-labelledby': 'methodology-heading' } },
    children,
  );
}
