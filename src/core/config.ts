export const SCORING_CONFIG = {
  priorityFactor: 1.5,
  axisMin: -1,
  axisMax: 1,
  displayDecimals: 1,
} as const;

export type ScoringConfig = typeof SCORING_CONFIG;
