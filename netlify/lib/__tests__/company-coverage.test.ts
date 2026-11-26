import { afterEach, expect, it, vi } from 'vitest';
import { NAME_PROBEABLE, jsonld } from '../ats/index.js';
import { resolveCompany } from '../ats/probe.js';

afterEach(() => vi.restoreAllMocks());

it('treats an employer URL as its own source and offers to save the supplied page when unreadable', async () => {
  const probes = NAME_PROBEABLE.map(provider => vi.spyOn(provider, 'probe').mockResolvedValue({found:true,count:1}));
  const page = vi.spyOn(jsonld, 'fetchPostings').mockResolvedValue({ok:false, status:200, postings:[], error:'no published openings'});
  const report = await resolveCompany('https://careers.example.org/jobs/?utm_medium=email#roles');
  expect(report).toMatchObject({candidates:[], coverageUrl:'https://careers.example.org/jobs/'});
  expect(page).toHaveBeenCalledWith({source:'jsonld', token:'https://careers.example.org/jobs/'});
  for (const probe of probes) expect(probe).not.toHaveBeenCalled();
});

it('resolves a known Arabic name to its verified provider and spelling', async () => {
  for (const provider of NAME_PROBEABLE) vi.spyOn(provider, 'probe')
    .mockImplementation(async token => ({found:provider.source === 'ashby' && token === 'LeanTech',count:0}));
  expect((await resolveCompany('لين')).candidates).toEqual([{source:'ashby',token:'LeanTech',jobCount:0}]);
});
