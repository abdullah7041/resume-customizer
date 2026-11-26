import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
const mocks = vi.hoisted(() => ({ resolve: vi.fn(), track: vi.fn(), list: vi.fn(), save: vi.fn() }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ i18n: { language: 'en' } }) }));
vi.mock('@/services/jobFeed', () => ({ resolveCompany: mocks.resolve, trackCompany: mocks.track, listCoverageRequests: mocks.list, requestCompanyCoverage: mocks.save }));
import { CompanyLookup } from '@/components/sections/CompanyLookup';
beforeEach(() => { vi.clearAllMocks(); mocks.list.mockResolvedValue({data:{requests:[]},error:null}); });
function search() {
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Salla' } });
  fireEvent.click(screen.getByRole('button', { name: /Find board|Search company/ }));
}
it('makes the company search progress and empty outcome visible', async () => {
  let finish: (result: unknown) => void = () => {};
  mocks.resolve.mockReturnValue(new Promise(resolve => { finish = resolve; }));
  render(<CompanyLookup />); search();
  expect(screen.getByRole('status')).toHaveTextContent(/Searching/);
  finish({ data: { candidates: [], unreliable: [], exhausted: false, fallback: 'paste_job_url' }, error: null });
  expect(await screen.findByText(/No supported board/)).toBeVisible();
});
it('shows rejected requests as actionable errors', async () => {
  mocks.resolve.mockRejectedValue(new Error('Connection interrupted'));
  render(<CompanyLookup />); search();
  expect(await screen.findByRole('alert')).toHaveTextContent('Connection interrupted');
  expect(screen.getByRole('button', { name: /Search company|Find board/ })).toBeEnabled();
});
it('can request coverage of a supplied careers URL even when the board lookup times out', async () => {
  mocks.resolve.mockRejectedValue(new Error('Board check timed out'));
  render(<CompanyLookup />);
  fireEvent.change(screen.getByRole('textbox'), {target:{value:'https://careers.example.org/jobs'}});
  fireEvent.click(screen.getByRole('button', {name:'Search company'}));
  expect(await screen.findByRole('button', {name:'Save company and request coverage'})).toBeEnabled();
  expect(screen.getByRole('alert')).toHaveTextContent('Board check timed out');
});
it('refreshes followed companies only after a confirmed successful follow', async () => {
  const onFollowed = vi.fn();
  mocks.resolve.mockResolvedValue({ data: { candidates: [{ source: 'workable', token: 'salla', jobCount: 2 }], unreliable: [], exhausted: false }, error: null });
  mocks.track.mockResolvedValue({ data: { company: { id: 'salla' }, crawlDispatched: false }, error: null });
  render(<CompanyLookup onFollowed={onFollowed} />); search();
  fireEvent.click(await screen.findByRole('button', { name: /Follow jobs/ }));
  expect(await screen.findByText(/Company followed/)).toBeVisible();
  expect(onFollowed).toHaveBeenCalledOnce();
  expect(screen.queryByText(/Board check requested/)).not.toBeInTheDocument();
});

it('saves an unsupported careers page and shows its status after reopening', async () => {
  const url = 'https://careers.example.org/jobs';
  const rows: { careers_url: string; company: null }[] = [];
  mocks.resolve.mockResolvedValue({data:{candidates:[],exhausted:true,coverageUrl:url}});
  mocks.list.mockImplementation(async () => ({data:{requests:[...rows]}}));
  mocks.save.mockImplementation(async () => { rows.push({careers_url:url,company:null}); return {data:{careersUrl:url}}; });
  const view = render(<CompanyLookup />);
  fireEvent.change(screen.getByRole('textbox'), {target:{value:url}});
  fireEvent.click(screen.getByRole('button', {name:'Search company'}));
  fireEvent.click(await screen.findByRole('button', {name:'Save company and request coverage'}));
  expect(await screen.findByRole('link', {name:url})).toHaveAttribute('href',url);
  view.unmount(); render(<CompanyLookup />);
  expect(await screen.findByText('Coverage requested')).toBeVisible();
  expect(mocks.save).toHaveBeenCalledOnce();
  expect(mocks.track).not.toHaveBeenCalled();
});

it('lets a candidate follow a saved employer when a verified board becomes available', async () => {
  const url = 'https://careers.example.org/jobs';
  const company = {id:'known',source:'ashby',token:'Example',display_name:'Example'};
  mocks.list.mockResolvedValue({data:{requests:[{careers_url:url,company}]}});
  mocks.track.mockResolvedValue({data:{company,crawlDispatched:true}});
  const view = render(<CompanyLookup />);
  fireEvent.click(await screen.findByRole('button',{name:'Coverage available · Follow jobs'}));
  expect(await screen.findByText('Company followed. Board check requested.')).toBeVisible();
  expect(mocks.track).toHaveBeenCalledWith({source:'ashby',token:'Example',displayName:'Example',coverageRequestUrl:undefined});
  view.rerender(<CompanyLookup directory={[{...company, company_category:'unclassified', sector:null, last_status:'ok', last_fetched_at:null, followed:true}]} />);
  expect(await screen.findByText('Following jobs')).toBeVisible();
});
