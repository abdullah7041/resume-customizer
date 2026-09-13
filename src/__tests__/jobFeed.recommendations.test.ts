import { describe, expect, it } from 'vitest';
import { buildFeed } from '@/lib/jobs/score';
import { candidateEvidence, extractRequirements, groundProfile } from '@/lib/jobs/evidence';
import { crawlProgress } from '@/lib/jobs/boardFreshness';
import type { FeedPosting } from '@/lib/jobs/types';

const posting: FeedPosting = { id: 'p', companyId: 'c', companyName: 'Company', title: 'Operations Specialist', location: 'Riyadh', applyUrl: 'https://example.com', postedAt: null, firstSeenAt: '2026-09-10' };
const sources = [{ id: 'work:0', text: 'Built Power BI dashboards and automated SQL reports.' }];
const profile = { capabilities: [{ skill: 'Power BI', aliases: ['Power BI'], sourceId: 'work:0', evidence: sources[0].text }, { skill: 'SQL', aliases: ['SQL'], sourceId: 'work:0', evidence: sources[0].text }] };

describe('evidence recommendations', () => {
  it('keeps an adjacent title based on demonstrated work and exposes unknown requirements', () => {
    const requirements = extractRequirements('Requirements:\nBuild Power BI dashboards\nWrite SQL reports\nMust hold PMP certification');
    const feed = buildFeed([posting], { targetRoles: ['Data Analyst'] }, { profile, requirements: { p: requirements } });
    expect(feed.kept).toHaveLength(1);
    expect(feed.kept[0].recommendation?.reasons).toHaveLength(2);
    expect(feed.kept[0].recommendation?.gaps).toContain('Must hold PMP certification');
    expect(feed.kept[0].recommendation?.kind).toBe('adjacent');
  });
  it('labels a role strong only when every extracted requirement has evidence', () => {
    const requirements = extractRequirements('Requirements:\nBuild Power BI dashboards\nWrite SQL reports');
    const feed = buildFeed([posting], { targetRoles: ['Data Analyst'] }, { profile, requirements: { p: requirements } });
    expect(feed.kept[0].recommendation).toMatchObject({ kind: 'strong', gaps: [] });
  });
  it('does not accept fabricated quotes or skills-list-only evidence', () => {
    expect(groundProfile({ capabilities: [...profile.capabilities, { skill: 'Python', aliases: ['Python'], sourceId: 'skills:0', evidence: 'Python' }] }, sources).capabilities).toHaveLength(2);
    expect(groundProfile({ capabilities: [{ ...profile.capabilities[0], evidence: 'Invented experience' }] }, sources).capabilities).toEqual([]);
  });
  it('re-ranks when the JD or preferences change without changing the profile', () => {
    expect(buildFeed([posting], { targetRoles: ['Analyst'], locations: ['Jeddah'] }, { profile, requirements: { p: extractRequirements('Power BI dashboards') } }).dropped[0].reason).toBe('location');
    expect(buildFeed([posting], { targetRoles: ['Analyst'] }, { profile, requirements: { p: extractRequirements('Requires licensed nursing qualification') } }).kept).toHaveLength(0);
  });
  it('does not confuse SQL with NoSQL or bypass role filters while requirements are unavailable', () => {
    expect(buildFeed([posting], { targetRoles: ['Operations'] }, { profile, requirements: { p: extractRequirements('NoSQL administration') } }).kept[0].recommendation?.reasons).toEqual([]);
    expect(buildFeed([posting], { targetRoles: ['Analyst'] }, { profile }).dropped[0].reason).toBe('role');
  });
  it('uses an unbulleted work description as candidate evidence', () => {
    const evidence = candidateEvidence({ work: [{ description: 'Built an Arabic-first AI resume platform.', highlights: [], name: 'Watheq', position: 'Founder', startDate: '2024', endDate: 'Present', summary: '' }] });
    expect(evidence).toEqual([{ id: 'work:0', text: 'Built an Arabic-first AI resume platform.' }]);
  });
});

describe('crawl completion', () => {
  it('requires a new completed attempt, and reports partial failures', () => {
    const request = { companyIds: ['a', 'b'], requestedAt: '2026-09-10T10:00:00Z' };
    expect(crawlProgress(request, [{ companyId: 'a', lastStatus: 'ok', lastFetchedAt: '2026-09-09' }]).status).toBe('queued');
    expect(crawlProgress(request, [{ companyId: 'a', lastStatus: 'ok', lastFetchedAt: '2026-09-10T10:00:02Z' }, { companyId: 'b', lastStatus: 'failed', lastFetchedAt: '2026-09-10T10:00:03Z' }]).status).toBe('partial');
  });
});
