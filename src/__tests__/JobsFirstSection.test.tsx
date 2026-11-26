import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
const mocks=vi.hoisted(()=>({search:vi.fn(),verify:vi.fn(),save:vi.fn(),handoff:vi.fn(),setIntent:vi.fn(),intent:null as {targetRoles:string[]} | null,serverIntent:vi.fn(),track:vi.fn(),notify:vi.fn()}));
vi.mock('react-i18next',()=>({useTranslation:()=>({t:(_key:string,fallback:string)=>fallback,i18n:{language:'en'}})}));
vi.mock('@/components/sections/JobFeedSection',()=>({default:()=>null}));
vi.mock('@/components/sections/JobAlertSettings',()=>({JobAlertSettings:()=>null}));
vi.mock('@/components/sections/PipelineSection',()=>({PipelineSection:()=> <div>Saved applications workspace</div>}));
vi.mock('@/services/jobSearch',()=>({searchJobs:mocks.search}));
vi.mock('@/services/jobFeed',()=>({listCoverageRequests:vi.fn(async()=>({data:{requests:[]},error:null})),fetchServerSearchIntent:mocks.serverIntent,getPostingDescription:vi.fn(async()=> 'Job description'),saveSearchIntent:vi.fn(async()=>({error:null})),listFeedState:vi.fn(async()=>new Map()),setFeedState:vi.fn(),trackCompany:mocks.track,verifyFeedPosting:mocks.verify}));
vi.mock('@/services/pipeline',()=>({createJobApplication:mocks.save}));
vi.mock('@/lib/stores/resumeStore',()=>({useSearchIntent:()=>mocks.intent,useResumeStore:{getState:()=>({setSearchIntent:mocks.setIntent})}}));
vi.mock('@/lib/resumeLibrary',()=>({useResumeLibraryStore:(select:(s:unknown)=>unknown)=>select({activeResumeId:'cv',entries:[{id:'cv',fingerprint:'v1',name:'My CV',plainText:'AI experience'}]})}));
import JobsFirstSection from '@/components/sections/JobsFirstSection';
const posting={id:'job',companyId:'company',companyName:'Example employer',title:'AI Engineer',location:'Riyadh',applyUrl:'https://example.test/jobs',postedAt:null,firstSeenAt:'2026-11-16T00:00:00Z'};
beforeEach(()=>{
 vi.clearAllMocks();mocks.intent={targetRoles:['AI Engineer']};mocks.serverIntent.mockResolvedValue(null);vi.stubEnv('VITE_JOB_CATALOGUE_ENABLED','true');
 mocks.search.mockResolvedValue({postings:[posting],companies:[],nextOffset:null});
 mocks.save.mockResolvedValue({data:{id:'application'},error:null});
 mocks.track.mockResolvedValue({data:{company:{id:'company'},crawlDispatched:false},error:null});
 mocks.verify.mockResolvedValue({results:[{match:{score:72,summary_bullets:['Evidence from AI projects']}}],failures:[]});
});

const company={id:'company',display_name:'Example employer',company_category:'unclassified',sector:'Software',last_status:'ok',last_fetched_at:'2026-11-17T00:00:00Z',source:'workable',token:'example',followed:false};
it('keeps Applications inside the jobs journey with an explicit way back',async()=>{
 render(<JobsFirstSection/>); await screen.findByText('AI Engineer');
 fireEvent.click(screen.getByRole('button',{name:'Applications'}));
 await screen.findByText('Saved applications workspace');
 fireEvent.click(screen.getByRole('button',{name:'Back to jobs'}));
 expect(await screen.findByText('AI Engineer')).toBeVisible();
});
it('confirms following immediately and keeps unknown categories off job cards',async()=>{
 mocks.search.mockResolvedValue({postings:[posting],companies:[company],nextOffset:null});
 render(<JobsFirstSection onToast={mocks.notify}/>); await screen.findByText('AI Engineer');
 expect(screen.queryByText(/Unclassified/)).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Explore companies'}));
 fireEvent.click(await screen.findByRole('button',{name:'Follow jobs'}));
 await screen.findByRole('button',{name:'Following'});
 expect(mocks.notify).toHaveBeenCalledWith(expect.objectContaining({type:'success',title:expect.stringContaining('Company followed')}));
});
it('searches the verified directory directly before probing an external board',async()=>{
 mocks.search.mockResolvedValue({postings:[posting],companies:[company,{...company,id:'other',display_name:'Other employer',sector:'Healthcare'}],nextOffset:null});
 render(<JobsFirstSection/>); await screen.findByText('AI Engineer');
 fireEvent.click(screen.getByRole('button',{name:'Explore companies'}));
 fireEvent.change(screen.getByRole('textbox',{name:'Search companies'}),{target:{value:'Software'}});
 expect(screen.getByRole('heading',{name:'Example employer'})).toBeVisible();
 expect(screen.queryByRole('heading',{name:'Other employer'})).not.toBeInTheDocument();
});
it('labels the directory total accurately when a newly followed board is listed', async () => {
 mocks.search.mockResolvedValue({ postings:[posting], companies:[company,{...company,id:'new',display_name:'New board',followed:true,last_status:'pending',last_fetched_at:null}], nextOffset:null });
 render(<JobsFirstSection />);
 await screen.findByText('AI Engineer');
 fireEvent.click(screen.getByRole('button',{name:'Explore companies'}));
 expect(await screen.findByText('2 companies')).toBeVisible();
 expect(screen.getByRole('heading',{name:'New board'})).toBeVisible();
});
it('searches without follows, checks explicit matches, and hands the selected description to tailoring',async()=>{
 render(<JobsFirstSection onMatchPosting={mocks.handoff}/>);
 await screen.findByText('AI Engineer');
 expect(mocks.search.mock.calls[0][0]).toMatchObject({targetRoles:['AI Engineer'],followedOnly:false});
 expect(mocks.verify).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Check my matches (up to 10)'}));
 await screen.findByText('CV alignment · 72%');
 expect(screen.getByText('Evidence from AI projects')).toBeVisible();
 fireEvent.click(screen.getByRole('button',{name:'Review & tailor'}));
 await waitFor(()=>expect(mocks.handoff).toHaveBeenCalledWith(expect.objectContaining({jobDescription:'Job description',companyName:'Example employer'})));
});
it('saving a job is explicit and repeated clicks cannot submit twice',async()=>{
 render(<JobsFirstSection/>);await screen.findByText('AI Engineer');
 fireEvent.click(screen.getByRole('button',{name:'Save'}));
 await screen.findByRole('button',{name:'Saved'});
 expect(mocks.save).toHaveBeenCalledOnce();
 expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({status:'saved'}),{duplicateStrategy:'preserve_user_fields'});
 expect(screen.getByRole('button',{name:'Saved'})).toBeDisabled();
 expect(screen.getByRole('link',{name:'Apply on employer site'})).toHaveAttribute('href',posting.applyUrl);
});
it('restores a completed individual check after filters and remount, without another verification', async () => {
 const { fingerprintText } = await import('@/lib/match/assessmentContext');
 const revision = await fingerprintText('Job description');
 const match = { score: 83 };
 const page = { postings: [posting], companies: [], nextOffset: null };
 mocks.search.mockResolvedValueOnce(page).mockResolvedValue({ ...page, checks: { job: { status: 'ready', match, jobRevision: revision } } });
 mocks.verify.mockResolvedValue({ results: [{ match }], jobRevision: revision, failures: [] });
 const view = render(<JobsFirstSection onMatchPosting={mocks.handoff}/>);
 fireEvent.click(await screen.findByRole('button', { name: 'Check this job' }));
 await screen.findByText('CV alignment · 83%');
 fireEvent.change(screen.getByRole('combobox', { name: 'Published within' }), { target: { value: '30' } });
 await screen.findByText('CV alignment · 83%');
 view.unmount();
 render(<JobsFirstSection onMatchPosting={mocks.handoff}/>);
 await screen.findByText('CV alignment · 83%');
 fireEvent.click(screen.getByRole('button', { name: 'Review & tailor' }));
 await waitFor(() => expect(mocks.handoff).toHaveBeenCalledWith(expect.objectContaining({ match })));
 expect(mocks.verify).toHaveBeenCalledOnce();
});
it('offers a recheck without showing a previous score for a changed CV or posting', async () => {
 mocks.search.mockResolvedValue({ postings: [posting], companies: [], checks: { job: { status: 'stale' } }, nextOffset: null });
 render(<JobsFirstSection/>);
 await screen.findByText('Needs recheck');
 expect(screen.queryByText(/CV alignment ·/)).not.toBeInTheDocument();
 expect(screen.getByRole('button', { name: 'Check this job' })).toBeEnabled();
 expect(mocks.verify).not.toHaveBeenCalled();
});

it('continues to unchecked jobs after ten descriptions are unavailable',async()=>{
 mocks.search.mockResolvedValue({postings:Array.from({length:20},(_,index)=>({...posting,id:'job'+index})),companies:[],nextOffset:null});
 mocks.verify.mockResolvedValue({results:[],failures:[{code:'missing_description'}]});
 render(<JobsFirstSection/>);await screen.findAllByText('AI Engineer');
 fireEvent.click(screen.getByRole('button',{name:'Check my matches (up to 10)'}));
 await screen.findByText('0 CV checks completed · 10 need attention');
 fireEvent.click(screen.getByRole('button',{name:'Check my matches (up to 10)'}));
 await screen.findByText('0 CV checks completed · 20 need attention');
 expect(new Set(mocks.verify.mock.calls.map(call=>call[0])).size).toBe(20);
});
it('marks an interrupted match request as failed and offers an explicit retry',async()=>{
 mocks.verify.mockRejectedValue(new Error('Connection interrupted'));
 render(<JobsFirstSection/>);await screen.findByText('AI Engineer');
 fireEvent.click(screen.getByRole('button',{name:'Check my matches (up to 10)'}));
 await screen.findByText('0 CV checks completed · 1 need attention');
 expect(screen.getByRole('button',{name:'Retry failed checks'})).toBeEnabled();
 expect(screen.queryByText('CV alignment · 0%')).not.toBeInTheDocument();
});
it('hydrates a saved server search in a fresh browser',async()=>{
 mocks.intent=null;mocks.serverIntent.mockResolvedValue({targetRoles:['Data Analyst'],locations:['Jeddah']});
 render(<JobsFirstSection/>);
 await waitFor(()=>expect(mocks.search).toHaveBeenCalledWith(expect.objectContaining({targetRoles:['Data Analyst'],locations:['Jeddah']}),expect.any(AbortSignal)));
 expect(screen.getByRole('textbox',{name:'Target roles'})).toHaveValue('Data Analyst');
});
it('keeps user edits when saved server preferences arrive late',async()=>{
 mocks.intent=null;let resolveIntent:(value:unknown)=>void=()=>{};
 mocks.serverIntent.mockImplementation(()=>new Promise(resolve=>{resolveIntent=resolve;}));
 render(<JobsFirstSection/>);
 fireEvent.change(screen.getByRole('textbox',{name:'Target roles'}),{target:{value:'My chosen role'}});
 resolveIntent({targetRoles:['Old role']});
 await waitFor(()=>expect(screen.getByRole('textbox',{name:'Target roles'})).toHaveValue('My chosen role'));
 expect(mocks.search.mock.calls.every(call=>!call[0].targetRoles.includes('Old role'))).toBe(true);
});
