export const SCORING_CONFIG = {
  priorityFactor: 1.5,
  axisMin: -1,
  axisMax: 1,
  displayDecimals: 1,
  // Umbrales de comparabilidad para el ranking principal, no de contrato de datos.
  minCoverage: 0.6,
  minComparedQuestions: 10,
} as const;

export type ScoringConfig = typeof SCORING_CONFIG;
