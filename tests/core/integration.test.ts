import { describe, expect, it } from 'vitest';

import { loadData } from '../../src/data/load';
import {
  computeResults,
  getApplicableParties,
  type QuestionAnswer,
} from '../../src/core/scoring';

const data = loadData();

const ESTATAL_COUNT = data.parties.filter((party) => party.scope === 'estatal').length;

const TERRITORY_PARTY_COUNTS: Record<string, number> = {
  cataluna: 7,
  'pais-vasco': 7,
  navarra: 6,
  galicia: 6,
  canarias: 6,
  andalucia: 5,
  ceuta: 5,
  melilla: 5,
};

function territorialPartiesFor(territoryId: string): string[] {
  return data.parties
    .filter((party) => party.scope === 'territorial' && party.communities?.includes(territoryId))
    .map((party) => party.id);
}

function fullAnswerSet(): QuestionAnswer[] {
  return data.questions.map((question) => ({
    questionId: question.id,
    optionIds: [question.options[0].id],
    priority: false,
  }));
}

describe('invariante territorial sobre los 19 territorios', () => {
  it('solo hace aplicables los estatales y los territoriales de la comunidad elegida', () => {
    for (const territory of data.territories) {
      const applicable = getApplicableParties(data, territory.id);
      for (const party of applicable) {
        const applies =
          party.scope === 'estatal' || (party.communities?.includes(territory.id) ?? false);
        expect(applies).toBe(true);
      }
      const expected = ESTATAL_COUNT + territorialPartiesFor(territory.id).length;
      expect(applicable).toHaveLength(expected);
    }
  });

  it('no hace aplicables los 11 partidos en ninguna comunidad', () => {
    for (const territory of data.territories) {
      expect(getApplicableParties(data, territory.id).length).toBeLessThan(data.parties.length);
    }
  });

  it('respeta los recuentos ancla por comunidad', () => {
    for (const [territoryId, expected] of Object.entries(TERRITORY_PARTY_COUNTS)) {
      expect(getApplicableParties(data, territoryId)).toHaveLength(expected);
    }
  });

  it('excluye a los partidos no aplicables del ranking, la cobertura y los ganadores', () => {
    const answers = fullAnswerSet();
    for (const territory of data.territories) {
      const results = computeResults(data, { territoryId: territory.id, answers });
      const applicableIds = new Set(results.applicableParties.map((party) => party.id));
      const nonApplicableIds = new Set(results.nonApplicableParties.map((party) => party.id));

      expect(nonApplicableIds.size).toBeGreaterThan(0);

      for (const score of [...results.ranking, ...results.withoutData]) {
        expect(applicableIds.has(score.party.id)).toBe(true);
        expect(nonApplicableIds.has(score.party.id)).toBe(false);
      }

      for (const question of results.questions) {
        for (const winner of question.winners) {
          expect(applicableIds.has(winner.id)).toBe(true);
        }
      }
    }
  });

  it('solo puntúa partidos aplicables en los casos ancla', () => {
    const answers = fullAnswerSet();
    for (const territoryId of Object.keys(TERRITORY_PARTY_COUNTS)) {
      const results = computeResults(data, { territoryId, answers });
      const applicableIds = new Set(results.applicableParties.map((party) => party.id));
      expect(new Set(results.ranking.map((score) => score.party.id))).toEqual(applicableIds);
      expect(results.withoutData).toEqual([]);
    }
  });

  it('no pierde partidos al separar elegibles y baja cobertura con respuestas completas', () => {
    const answers = fullAnswerSet();
    for (const territoryId of Object.keys(TERRITORY_PARTY_COUNTS)) {
      const results = computeResults(data, { territoryId, answers });
      expect(results.partialComparison).toBe(false);

      const classified = [
        ...results.ranking.filter((score) => score.eligible),
        ...results.lowCoverage,
      ].map((score) => score.party.id);
      expect(new Set(classified)).toEqual(
        new Set(results.ranking.map((score) => score.party.id)),
      );
    }
  });
});
