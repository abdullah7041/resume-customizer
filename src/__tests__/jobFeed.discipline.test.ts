import { expect, it } from 'vitest';
import { dropReason } from '@/lib/jobs/filters';
import type { FeedPosting } from '@/lib/jobs/types';
import { matchedRoleTerms } from '@/lib/jobs/normalize';
const posting = (title: string) => ({ title, location: 'Riyadh' } as FeedPosting);
it('requires a discipline match rather than a generic engineering word', () => {
  const intent = { targetRoles: ['AI Product Engineer'] };
  expect(dropReason(posting('Risk Engineer I'), intent)).toBe('role');
  expect(dropReason(posting('Information Security Engineer'), intent)).toBe('role');
  expect(dropReason(posting('AI Engineer'), intent)).toBeNull();
  expect(dropReason(posting('BI Analyst'), { targetRoles: ['BI Analyst', 'HR Manager'] })).toBeNull();
  expect(dropReason(posting('مهندس كهرباء'), { targetRoles: ['مهندس بيانات'] })).toBe('role');
  expect(dropReason(posting('مهندس بيانات'), { targetRoles: ['مهندس بيانات'] })).toBeNull();
});

it.each([['AI Consultant','Tax Consultant'],['Product Designer','Graphic Designer'],['Sales Representative','Medical Representative']])('requires discipline for %s', (role,title)=>{expect(dropReason(posting(title),{targetRoles:[role]})).toBe('role');});

it.each([
  ['Data analyst', 'IBM DataPower Integration Developer'],
  ['Data analyst', 'Database Administrator'],
  ['Sales Representative', 'Salesforce Developer'],
  ['Product Designer', 'Production Planner'],
])('does not treat a compound prefix as the discipline in %s', (role, title) => {
  expect(dropReason(posting(title), { targetRoles: [role] })).toBe('role');
});

it('keeps ordinary inflections, bilingual tokens and short discipline terms', () => {
  expect(matchedRoleTerms('Engineering Developers', ['engineer', 'develop'])).toEqual(['engineer', 'develop']);
  expect(matchedRoleTerms('مهندسون بيانات', ['مهندس', 'بيانات'])).toEqual(['مهندس', 'بيانات']);
  expect(matchedRoleTerms('AI / ML / BI / HR', ['ai', 'ml', 'bi', 'hr'])).toEqual(['ai', 'ml', 'bi', 'hr']);
});
