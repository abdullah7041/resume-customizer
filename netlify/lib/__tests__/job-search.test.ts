import { expect, it } from 'vitest';
import { classifyEmployer, searchPostings } from '../job-search.js';
import classifications from '../../../src/lib/jobs/employer-classifications.json';
import verifiedEmployers from '../../../research/job-catalogue-verified-2026-11-16.json';
import type { FeedPosting } from '../../../src/lib/jobs/types.js';
it('filters and ranks before pagination, without requiring a follow', () => {
 const rows = ['Risk Engineer', 'AI Engineer', 'AI Product Engineer'].map((title, i) => ({id: String(i), title, location:'Riyadh', firstSeenAt:'2026-11-16T00:00:00Z', postedAt:null} as FeedPosting));
 const first = searchPostings(rows, {targetRoles:['AI Product Engineer']}, {offset:0, limit:1});
 expect(first.postings.map(p=>p.id)).toEqual(['2']);
 expect(first.nextOffset).toBe(1);
 const second = searchPostings(rows, {targetRoles:['AI Product Engineer']}, {offset:1, limit:1});
 expect(second.postings.map(p=>p.id)).toEqual(['1']);
 expect(second.nextOffset).toBeNull();
});

it('covers exactly the 30 verified ATS identities with dated primary evidence and sectors', () => {
 expect(Object.keys(classifications).sort()).toEqual(verifiedEmployers.map(row => `${row.source}:${row.token}`).sort());
 for (const [key, entry] of Object.entries(classifications)) {
  expect(key).toBe(`${entry.source}:${entry.token}`);
  expect(entry.sector).toBeTruthy();
  expect(entry.evidenceUrl).toMatch(/^https:\/\//);
  expect(Number.isFinite(Date.parse(entry.verifiedAt))).toBe(true);
 }
 expect(Object.values(classifications).filter(row => row.category === 'unclassified').map(row => row.displayName)).toEqual(['InnovationTeam', 'Pronto', 'KitchenPark', 'webook.com']);
});

it('fills verified metadata by ATS identity and keeps uncertain stages unclassified', () => {
 const result = classifyEmployer({source:'workable', token:'salla', company_category:'unclassified', sector:null});
 expect(result).toMatchObject({company_category:'scaleup',sector:'E-commerce software',category_evidence:{source:'https://salla.com/en/ai-info',verifiedAt:'2026-11-17'}});
 expect(classifyEmployer({source:'workable',token:'innovationteam',company_category:'unclassified'})).toMatchObject({company_category:'unclassified',sector:'IT services and consulting',category_evidence:null});
 expect(classifyEmployer({source:'greenhouse',token:'salla',company_category:'unclassified'}).company_category).toBe('unclassified');
});

it('corrects older dated metadata but preserves newer reviews including deliberate unknowns', () => {
 expect(classifyEmployer({source:'workable',token:'lucidya',company_category:'startup',sector:'Software',classification_verified_at:'2026-11-16'}).company_category).toBe('scaleup');
 for (const category of ['enterprise', 'unclassified']) for (const verifiedAt of ['2026-11-17', '2026-11-18']) {
  const result = classifyEmployer({source:'workable',token:'salla',company_category:category,sector:null,classification_source:'https://example.test/owner-review',classification_verified_at:verifiedAt});
  expect(result).toMatchObject({company_category:category,sector:null,classification_source:'https://example.test/owner-review',classification_verified_at:verifiedAt});
 }
 expect(classifyEmployer({source:'workable',token:'salla',company_category:'enterprise',sector:'Owner sector'})).toMatchObject({company_category:'enterprise',sector:'Owner sector'});
 const mixed = classifyEmployer({source:'workable',token:'salla',company_category:'enterprise',sector:null,classification_source:'https://example.test/owner-review'});
 expect(mixed).toMatchObject({company_category:'enterprise',sector:'E-commerce software',classification_source:'https://example.test/owner-review',category_evidence:{source:'https://example.test/owner-review'},sector_evidence:{source:'https://salla.com/en/ai-info'}});
});
