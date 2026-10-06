import { SCORING_CONFIG } from '../core/config';
import type { DataBundle } from '../data/schema';

import { createButton, el } from './components';
import { formatDate } from './format';
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
      text: 'Temas incluidos y la evidencia que los respalda (encuestas del CIS, agenda o programas electorales).',
    }),
    el('p', {
      className: 'section-lead',
      text: 'La prioridad de los temas del bloque A se apoya en el CIS, Estudio 3577 (septiembre de 2026). Es una fuente institucional que puede percibirse como sesgada; por eso la citamos con URL y fecha, la complementamos con agenda y programas, y no la usamos para estimar voto.',
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
    section('methodology-formula-heading', 'Cómo se calcula la afinidad', [
      el('p', {
        text: 'Cada pregunta sitúa tus respuestas en un eje de −1 a +1. La afinidad con un partido en un tema es la cercanía entre ambas posiciones:',
      }),
      el('p', {
        className: 'formula',
        text: 'afinidad = 1 − |tu posición − posición del partido| / 2',
      }),
      el('p', {
        text: `La distancia máxima del eje es 2, así que la afinidad va de 0 a 1 (de 0 % a 100 %). Los temas que marques como prioritarios pesan ${String(SCORING_CONFIG.priorityFactor).replace('.', ',')} veces más (puedes elegir hasta ${MAX_PRIORITY_TOPICS} en el paso inicial).`,
      }),
      el('p', {
        text: 'La afinidad de un partido es la media ponderada de la afinidad en los temas que respondiste y en los que el partido tiene posición documentada. La cobertura es la parte de tus respuestas (ponderadas) con dato disponible para ese partido. El redondeo a un decimal solo se aplica al mostrar.',
      }),
    ]),
    section('methodology-coverage-heading', 'Cobertura y datos faltantes', [
      el('p', {
        text: 'Si un partido no tiene posición documentada en un tema, esa pregunta se excluye de su media y reduce su cobertura; nunca se le asigna un valor inventado.',
      }),
      el('p', {
        text: 'Un partido sin ningún dato entre tus respuestas aparece bajo «Sin datos suficientes», sin porcentaje. Los partidos que no concurren en tu comunidad no se puntúan y se listan aparte.',
      }),
    ]),
    section('methodology-status-heading', 'Estados de los datos y actualización', [
      el('p', {
        text: 'Cada posición guarda su fuente, su fecha y un estado: «verificado» cuando procede de un programa o una fuente del ciclo de 2026, «provisional» cuando se apoya en evidencia anterior, y «sin datos suficientes» cuando la búsqueda no encontró una posición atribuible.',
      }),
      el('p', {
        text: `La fecha de última actualización del conjunto de datos aparece en los resultados («Datos actualizados el ${formatDate(data.meta.updatedAt)}»). Actualizar posiciones solo requiere editar los ficheros de datos y volver a validarlos.`,
      }),
    ]),
    section('methodology-neutrality-heading', 'Neutralidad y orden', [
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
        text: 'El eje de la pregunta sobre corrupción va de más transparencia y controles previos (−1) a menos burocracia y administración más ágil (+1); el signo de cada posición sigue ese criterio.',
      }),
    ]),
    renderTopicCatalog(data),
    section('methodology-scope-heading', 'Alcance', [
      el('p', {
        text: 'Esta herramienta es informativa y orientativa. No es una predicción electoral ni una estimación de voto: mide la cercanía entre tus respuestas y las posiciones documentadas, nada más.',
      }),
      el('p', {
        text: 'No recogemos cuentas, datos personales, cookies ni analítica; tus respuestas se quedan en tu navegador y se pierden al recargar.',
      }),
    ]),
    section('methodology-rights-heading', 'Reutilización y derechos', [
      el('p', {
        text: 'Los datos del CIS se citan y enlazan a su publicación oficial; los programas y documentos de los partidos se enlazan, sin reproducir textos extensos. Este proyecto no usa logos ni marcas de partidos.',
      }),
      el('p', {
        text: 'Puedes reutilizar esta herramienta citando la fuente y enlazando a los originales.',
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
