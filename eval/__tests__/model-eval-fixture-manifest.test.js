import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const manifestPath = resolve(repoRoot, 'eval/model-eval-fixture-manifest.json');
const primaryFeatures = [
  'parse',
  'match',
  'optimize',
  'truth-check',
  'cover-letter',
  'interview',
];
const primaryCaseTypes = ['positive', 'negative', 'adversarial'];
const primaryLanguages = ['en', 'ar', 'mixed'];

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const hasText = (value) => typeof value === 'string' && value.trim().length > 0;
const hasScoreBand = (value) => (
  Array.isArray(value)
  && value.length === 2
  && value.every((score) => Number.isFinite(score) && score >= 0 && score <= 100)
  && value[0] <= value[1]
);

const validateNewFixture = (fixture, feature) => {
  expect(fixture.id).toEqual(expect.any(String));
  expect(fixture.feature).toBe(feature);
  expect(['en', 'ar', 'mixed']).toContain(fixture.language);
  expect(primaryCaseTypes).toContain(fixture.caseType);
  expect(fixture.synthetic).toBe(true);
  expect(fixture.safetyExpectations).toEqual(expect.objectContaining({
    groundedOnly: true,
    noInventedFacts: true,
  }));
  expect(fixture.requiredEvidenceTerms).toEqual(expect.any(Array));
  expect(fixture.requiredEvidenceTerms.length).toBeGreaterThan(0);
  expect(fixture.expected).toEqual(expect.objectContaining({
    scoreBand: expect.any(Array),
    flags: expect.any(Array),
  }));
  expect(hasScoreBand(fixture.expected.scoreBand)).toBe(true);
  expect(fixture.expected.flags.length).toBeGreaterThan(0);
  expect(hasText(fixture.resumeText)).toBe(true);

  if (feature === 'cover-letter' || feature === 'interview') {
    expect(hasText(fixture.jobDescription)).toBe(true);
  }
};

describe('model evaluation fixture manifest', () => {
  const manifest = readJson(manifestPath);

  it('freezes sufficient, varied fixture coverage for every primary decision feature', () => {
    expect(manifest.primaryFeatures).toEqual(expect.any(Object));

    for (const feature of primaryFeatures) {
      const entries = manifest.primaryFeatures[feature];
      expect(entries).toEqual(expect.any(Array));
      expect(entries.length).toBeGreaterThanOrEqual(8);
      expect(new Set(entries.map((entry) => entry.id)).size).toBe(entries.length);

      for (const language of primaryLanguages) {
        expect(entries.some((entry) => entry.language === language)).toBe(true);
      }
      expect(entries.filter((entry) => entry.language === 'ar').length).toBeGreaterThanOrEqual(2);
      for (const caseType of primaryCaseTypes) {
        expect(entries.some((entry) => entry.caseType === caseType)).toBe(true);
      }
    }
  });

  it('keeps manifest references metadata-only and validates the newly authored direct-contract fixtures', () => {
    for (const feature of primaryFeatures) {
      for (const entry of manifest.primaryFeatures[feature]) {
        expect(entry).toEqual(expect.objectContaining({
          id: expect.any(String),
          file: expect.any(String),
          language: expect.any(String),
          caseType: expect.any(String),
        }));
        expect(entry).not.toHaveProperty('resumeText');
        expect(entry).not.toHaveProperty('jobDescription');

        const fixture = readJson(resolve(repoRoot, entry.file));
        if (['truth-check', 'cover-letter', 'interview'].includes(feature)) {
          validateNewFixture(fixture, feature);
          expect(fixture.id).toBe(entry.id);
        }
      }
    }
  });

  it('keeps clarification and metadata as clearly labelled bilingual smoke coverage only', () => {
    expect(manifest.smokeOnlyFeatures).toEqual(expect.any(Object));

    for (const feature of ['clarification', 'metadata']) {
      const entries = manifest.smokeOnlyFeatures[feature];
      expect(entries).toEqual(expect.any(Array));
      expect(entries).toHaveLength(2);
      expect(entries.every((entry) => entry.selectionEligible === false)).toBe(true);
      expect(entries.every((entry) => entry.evaluationMode === 'smoke_only')).toBe(true);
      expect(new Set(entries.map((entry) => entry.language))).toEqual(new Set(['en', 'ar']));

      for (const entry of entries) {
        const fixture = readJson(resolve(repoRoot, entry.file));
        expect(fixture.id).toBe(entry.id);
        expect(fixture.feature).toBe(feature);
        expect(fixture.synthetic).toBe(true);
        expect(fixture.selectionEligible).toBe(false);
        expect(fixture.evaluationMode).toBe('smoke_only');
        expect(hasText(fixture.jobDescription)).toBe(true);
        if (feature === 'clarification') {
          expect(hasText(fixture.resumeText)).toBe(true);
        }
      }
    }
  });
});
