import { SCORING_CONFIG } from '../core/config';
import type { PartyScore } from '../core/scoring';

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function roundToDecimals(value: number, decimals = SCORING_CONFIG.displayDecimals): number {
  return round(value, decimals);
}

export function formatPercent(value: number, decimals = SCORING_CONFIG.displayDecimals): string {
  return `${(value * 100).toFixed(decimals).replace('.', ',')} %`;
}

export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  if (!year || !month || !day) return isoDate;
  return `${day}/${month}/${year}`;
}

export function compareAffinityDescending(a: PartyScore, b: PartyScore): number {
  const difference = (b.affinity ?? 0) - (a.affinity ?? 0);
  if (difference !== 0) return difference;
  return a.party.displayName.localeCompare(b.party.displayName, 'es');
}

export function sortRanking(scores: PartyScore[]): PartyScore[] {
  return [...scores].sort(compareAffinityDescending);
}
