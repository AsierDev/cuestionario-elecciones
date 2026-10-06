export const SCORING_CONFIG = {
  priorityFactor: 1.5,
  axisMin: -1,
  axisMax: 1,
  displayDecimals: 0,
  // Umbrales de comparabilidad para el ranking principal, no de contrato de datos.
  minCoverage: 0.6,
  minComparedQuestions: 10,
} as const;

export type ScoringConfig = typeof SCORING_CONFIG;

export interface ScalePoint {
  value: number;
  label: string;
  shortLabel: string;
}

// Escala común a todas las propuestas: el usuario y los partidos se sitúan en los mismos cinco puntos.
export const ANSWER_SCALE: readonly ScalePoint[] = [
  { value: -1, label: 'Totalmente en contra', shortLabel: 'Muy en contra' },
  { value: -0.5, label: 'Más bien en contra', shortLabel: 'En contra' },
  { value: 0, label: 'Ni a favor ni en contra', shortLabel: 'Neutral' },
  { value: 0.5, label: 'Más bien a favor', shortLabel: 'A favor' },
  { value: 1, label: 'Totalmente a favor', shortLabel: 'Muy a favor' },
];

export function nearestScalePoint(value: number): ScalePoint {
  return ANSWER_SCALE.reduce((best, point) =>
    Math.abs(point.value - value) < Math.abs(best.value - value) ? point : best,
  );
}
