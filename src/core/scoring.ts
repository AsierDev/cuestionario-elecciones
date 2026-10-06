import type { DataBundle, Party, Position, Question } from '../data/schema';

import { SCORING_CONFIG } from './config';

export interface QuestionAnswer {
  questionId: string;
  optionIds: string[];
  priority: boolean;
}

export interface ScoringInput {
  territoryId: string;
  answers: QuestionAnswer[];
}

export interface PartyScore {
  party: Party;
  affinity: number | null;
  coverage: number | null;
  missingTopicIds: string[];
  provisional: boolean;
}

export interface QuestionResult {
  question: Question;
  userPosition: number;
  userOptionIds: string[];
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
  withoutData: PartyScore[];
  questions: QuestionResult[];
  provisional: boolean;
}

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

export function userPosition(question: Question, optionIds: string[]): number | null {
  if (optionIds.length === 0) return null;

  const valueById = new Map(question.options.map((option) => [option.id, option.value]));
  const values = optionIds.map((id) => {
    const value = valueById.get(id);
    if (value === undefined) {
      throw new Error(`La opción "${id}" no existe en la pregunta "${question.id}"`);
    }
    return value;
  });

  if (question.type === 'single') {
    if (values.length > 1) {
      throw new Error(`La pregunta "${question.id}" es de opción única pero recibió varias`);
    }
    return values[0];
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function questionAffinity(userPos: number, partyValue: number): number {
  const span = SCORING_CONFIG.axisMax - SCORING_CONFIG.axisMin;
  return 1 - Math.abs(userPos - partyValue) / span;
}

function indexPositionsByPartyTopic(data: DataBundle): Map<string, Map<string, Position>> {
  const byParty = new Map<string, Map<string, Position>>();
  for (const [partyId, rows] of Object.entries(data.positions)) {
    byParty.set(partyId, new Map(rows.map((row) => [row.topicId, row])));
  }
  return byParty;
}

interface AnsweredEntry {
  question: Question;
  userPosition: number;
  userOptionIds: string[];
  weight: number;
}

export function computeResults(data: DataBundle, input: ScoringInput): ScoringResults {
  const applicableParties = getApplicableParties(data, input.territoryId);
  const applicableIds = new Set(applicableParties.map((party) => party.id));
  const nonApplicableParties = data.parties
    .filter((party) => !applicableIds.has(party.id))
    .sort(compareByName);

  const questionById = new Map(data.questions.map((question) => [question.id, question]));
  const positionByPartyTopic = indexPositionsByPartyTopic(data);

  const answered: AnsweredEntry[] = [];
  for (const answer of input.answers) {
    const question = questionById.get(answer.questionId);
    if (!question) {
      throw new Error(`La pregunta "${answer.questionId}" no existe en el bundle de datos`);
    }
    const position = userPosition(question, answer.optionIds);
    if (position === null) continue;
    answered.push({
      question,
      userPosition: position,
      userOptionIds: [...answer.optionIds],
      weight: answer.priority ? SCORING_CONFIG.priorityFactor : 1,
    });
  }

  const totalWeight = answered.reduce((sum, entry) => sum + entry.weight, 0);
  const hasAnswers = answered.length > 0;

  const scores: PartyScore[] = applicableParties.map((party) => {
    const positions = positionByPartyTopic.get(party.id);
    let weightedSum = 0;
    let scorableWeight = 0;
    let provisional = false;
    const missingTopicIds: string[] = [];

    for (const entry of answered) {
      const row = positions?.get(entry.question.topicId);
      if (row && row.value !== null) {
        weightedSum += entry.weight * questionAffinity(entry.userPosition, row.value);
        scorableWeight += entry.weight;
        if (row.status === 'provisional') provisional = true;
      } else {
        missingTopicIds.push(entry.question.topicId);
      }
    }

    return {
      party,
      affinity: scorableWeight > 0 ? weightedSum / scorableWeight : null,
      coverage: totalWeight > 0 ? scorableWeight / totalWeight : null,
      missingTopicIds,
      provisional,
    };
  });

  const ranking = hasAnswers
    ? scores
        .filter((score) => score.affinity !== null)
        .sort((a, b) => (b.affinity ?? 0) - (a.affinity ?? 0) || compareByName(a.party, b.party))
    : [];

  const withoutData = hasAnswers
    ? scores
        .filter((score) => score.affinity === null)
        .sort((a, b) => compareByName(a.party, b.party))
    : [];

  const questions: QuestionResult[] = answered.map((entry) => {
    const withData: { party: Party; affinity: number }[] = [];
    for (const party of applicableParties) {
      const row = positionByPartyTopic.get(party.id)?.get(entry.question.topicId);
      if (row && row.value !== null) {
        withData.push({ party, affinity: questionAffinity(entry.userPosition, row.value) });
      }
    }

    if (withData.length === 0) {
      return {
        question: entry.question,
        userPosition: entry.userPosition,
        userOptionIds: entry.userOptionIds,
        bestAffinity: null,
        winners: [],
      };
    }

    const bestAffinity = Math.max(...withData.map((candidate) => candidate.affinity));
    const winners = withData
      .filter((candidate) => candidate.affinity === bestAffinity)
      .map((candidate) => candidate.party)
      .sort(compareByName);

    return {
      question: entry.question,
      userPosition: entry.userPosition,
      userOptionIds: entry.userOptionIds,
      bestAffinity,
      winners,
    };
  });

  return {
    territoryId: input.territoryId,
    applicableParties,
    nonApplicableParties,
    hasAnswers,
    answeredCount: answered.length,
    totalWeight,
    ranking,
    withoutData,
    questions,
    provisional: scores.some((score) => score.provisional),
  };
}
