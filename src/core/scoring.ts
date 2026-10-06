import type { DataBundle, Party, Position, Question, Topic } from '../data/schema';

import { ANSWER_SCALE, SCORING_CONFIG } from './config';

export interface QuestionAnswer {
  questionId: string;
  value: number;
  priority: boolean;
}

export interface ScoringInput {
  territoryId: string;
  answers: QuestionAnswer[];
}

export interface QuestionComparison {
  question: Question;
  userValue: number;
  partyValue: number;
  affinity: number;
  position: Position;
}

export interface TopicAffinity {
  topic: Topic;
  affinity: number | null;
  comparedCount: number;
}

export interface PartyScore {
  party: Party;
  affinity: number | null;
  coverage: number | null;
  comparedCount: number;
  answeredCount: number;
  eligible: boolean;
  missingQuestionIds: string[];
  provisional: boolean;
  comparisons: QuestionComparison[];
  topics: TopicAffinity[];
}

export interface PartyStance {
  party: Party;
  value: number | null;
  affinity: number | null;
  position: Position | undefined;
}

export interface QuestionResult {
  question: Question;
  userValue: number;
  priority: boolean;
  stances: PartyStance[];
  bestAffinity: number | null;
  winners: Party[];
}

export interface TopicResult {
  topic: Topic;
  answeredCount: number;
  priority: boolean;
  parties: { party: Party; affinity: number | null; comparedCount: number }[];
  bestAffinity: number | null;
  winners: Party[];
}

export interface ScoringResults {
  territoryId: string;
  applicableParties: Party[];
  nonApplicableParties: Party[];
  hasAnswers: boolean;
  answeredCount: number;
  totalWeight: number;
  ranking: PartyScore[];
  lowCoverage: PartyScore[];
  withoutData: PartyScore[];
  questions: QuestionResult[];
  topics: TopicResult[];
  provisional: boolean;
  partialComparison: boolean;
}

const VALID_VALUES = new Set(ANSWER_SCALE.map((point) => point.value));

function compareByName(a: Party, b: Party): number {
  return a.displayName.localeCompare(b.displayName, 'es');
}

export function getApplicableParties(data: DataBundle, territoryId: string): Party[] {
  return data.parties
    .filter(
      (party) =>
        party.scope === 'estatal' || (party.communities?.includes(territoryId) ?? false),
    )
    .sort(compareByName);
}

export function questionAffinity(userValue: number, partyValue: number): number {
  const span = SCORING_CONFIG.axisMax - SCORING_CONFIG.axisMin;
  return 1 - Math.abs(userValue - partyValue) / span;
}

function indexPositions(data: DataBundle): Map<string, Map<string, Position>> {
  const byParty = new Map<string, Map<string, Position>>();
  for (const [partyId, rows] of Object.entries(data.positions)) {
    byParty.set(partyId, new Map(rows.map((row) => [row.questionId, row])));
  }
  return byParty;
}

function weightedMean(entries: { weight: number; affinity: number }[]): number | null {
  const weight = entries.reduce((sum, entry) => sum + entry.weight, 0);
  if (weight === 0) return null;
  return entries.reduce((sum, entry) => sum + entry.weight * entry.affinity, 0) / weight;
}

function bestOf<T extends { party: Party; affinity: number | null }>(
  candidates: T[],
): { bestAffinity: number | null; winners: Party[] } {
  const scored = candidates.filter((candidate) => candidate.affinity !== null);
  if (scored.length === 0) return { bestAffinity: null, winners: [] };
  const bestAffinity = Math.max(...scored.map((candidate) => candidate.affinity ?? 0));
  const winners = scored
    .filter((candidate) => candidate.affinity === bestAffinity)
    .map((candidate) => candidate.party)
    .sort(compareByName);
  return { bestAffinity, winners };
}

interface AnsweredEntry {
  question: Question;
  userValue: number;
  priority: boolean;
  weight: number;
}

export function computeResults(data: DataBundle, input: ScoringInput): ScoringResults {
  const applicableParties = getApplicableParties(data, input.territoryId);
  const applicableIds = new Set(applicableParties.map((party) => party.id));
  const nonApplicableParties = data.parties
    .filter((party) => !applicableIds.has(party.id))
    .sort(compareByName);

  const questionById = new Map(data.questions.map((question) => [question.id, question]));
  const positions = indexPositions(data);

  const answered: AnsweredEntry[] = [];
  for (const answer of input.answers) {
    const question = questionById.get(answer.questionId);
    if (!question) {
      throw new Error(`La pregunta "${answer.questionId}" no existe en el bundle de datos`);
    }
    if (!VALID_VALUES.has(answer.value)) {
      throw new Error(`Valor de respuesta no válido (${answer.value}) en "${question.id}"`);
    }
    answered.push({
      question,
      userValue: answer.value,
      priority: answer.priority,
      weight: answer.priority ? SCORING_CONFIG.priorityFactor : 1,
    });
  }
  // Las respuestas se ordenan como el cuestionario, sea cual sea el orden de entrada.
  const order = new Map(data.questions.map((question, index) => [question.id, index]));
  answered.sort((a, b) => (order.get(a.question.id) ?? 0) - (order.get(b.question.id) ?? 0));

  const totalWeight = answered.reduce((sum, entry) => sum + entry.weight, 0);
  const hasAnswers = answered.length > 0;

  const scores: PartyScore[] = applicableParties.map((party) => {
    const partyPositions = positions.get(party.id);
    const comparisons: QuestionComparison[] = [];
    const weighted: { weight: number; affinity: number; topicId: string }[] = [];
    const missingQuestionIds: string[] = [];
    let provisional = false;

    for (const entry of answered) {
      const row = partyPositions?.get(entry.question.id);
      if (row && row.value !== null) {
        const affinity = questionAffinity(entry.userValue, row.value);
        comparisons.push({
          question: entry.question,
          userValue: entry.userValue,
          partyValue: row.value,
          affinity,
          position: row,
        });
        weighted.push({ weight: entry.weight, affinity, topicId: entry.question.topicId });
        if (row.status === 'provisional') provisional = true;
      } else {
        missingQuestionIds.push(entry.question.id);
      }
    }

    const scorableWeight = weighted.reduce((sum, entry) => sum + entry.weight, 0);
    const affinity = weightedMean(weighted);
    const coverage = totalWeight > 0 ? scorableWeight / totalWeight : null;

    const topics: TopicAffinity[] = data.topics.map((topic) => {
      const inTopic = weighted.filter((entry) => entry.topicId === topic.id);
      return { topic, affinity: weightedMean(inTopic), comparedCount: inTopic.length };
    });

    return {
      party,
      affinity,
      coverage,
      comparedCount: comparisons.length,
      answeredCount: answered.length,
      eligible:
        affinity !== null &&
        (coverage ?? 0) >= SCORING_CONFIG.minCoverage &&
        comparisons.length >= SCORING_CONFIG.minComparedQuestions,
      missingQuestionIds,
      provisional,
      comparisons,
      topics,
    };
  });

  // `ranking` incluye todos los partidos puntuados, por afinidad; `eligible` marca el ranking principal.
  const ranking = hasAnswers
    ? scores
        .filter((score) => score.affinity !== null)
        .sort((a, b) => (b.affinity ?? 0) - (a.affinity ?? 0) || compareByName(a.party, b.party))
    : [];

  const lowCoverage = hasAnswers
    ? scores
        .filter((score) => score.affinity !== null && !score.eligible)
        .sort((a, b) => compareByName(a.party, b.party))
    : [];

  const withoutData = hasAnswers
    ? scores
        .filter((score) => score.affinity === null)
        .sort((a, b) => compareByName(a.party, b.party))
    : [];

  const partialComparison = hasAnswers && answered.length < SCORING_CONFIG.minComparedQuestions;

  const questions: QuestionResult[] = answered.map((entry) => {
    const stances: PartyStance[] = applicableParties.map((party) => {
      const row = positions.get(party.id)?.get(entry.question.id);
      const value = row?.value ?? null;
      return {
        party,
        value,
        affinity: value === null ? null : questionAffinity(entry.userValue, value),
        position: row,
      };
    });
    return {
      question: entry.question,
      userValue: entry.userValue,
      priority: entry.priority,
      stances,
      ...bestOf(stances),
    };
  });

  const topics: TopicResult[] = data.topics
    .map((topic) => {
      const inTopic = answered.filter((entry) => entry.question.topicId === topic.id);
      const parties = scores.map((score) => {
        const topicScore = score.topics.find((item) => item.topic.id === topic.id);
        return {
          party: score.party,
          affinity: topicScore?.affinity ?? null,
          comparedCount: topicScore?.comparedCount ?? 0,
        };
      });
      return {
        topic,
        answeredCount: inTopic.length,
        priority: inTopic.some((entry) => entry.priority),
        parties,
        ...bestOf(parties),
      };
    })
    .filter((topic) => topic.answeredCount > 0);

  return {
    territoryId: input.territoryId,
    applicableParties,
    nonApplicableParties,
    hasAnswers,
    answeredCount: answered.length,
    totalWeight,
    ranking,
    lowCoverage,
    withoutData,
    questions,
    topics,
    provisional: scores.some((score) => score.provisional),
    partialComparison,
  };
}

export interface AgreementSummary {
  agreements: QuestionComparison[];
  disagreements: QuestionComparison[];
}

// Coincidencias y discrepancias más marcadas con un partido; el empate se resuelve por orden del cuestionario.
export function summarizeAgreement(score: PartyScore, limit = 3): AgreementSummary {
  const byAffinityDesc = [...score.comparisons].sort((a, b) => b.affinity - a.affinity);
  const agreements = byAffinityDesc.filter((item) => item.affinity >= 0.75).slice(0, limit);
  const disagreements = [...score.comparisons]
    .sort((a, b) => a.affinity - b.affinity)
    .filter((item) => item.affinity <= 0.5)
    .slice(0, limit);
  return { agreements, disagreements };
}
