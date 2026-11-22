import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
const mocks = vi.hoisted(() => ({ resolve: vi.fn(), track: vi.fn() }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ i18n: { language: 'en' } }) }));
vi.mock('@/services/jobFeed', () => ({ resolveCompany: mocks.resolve, trackCompany: mocks.track }));
import { CompanyLookup } from '@/components/sections/CompanyLookup';
beforeEach(() => { vi.clearAllMocks(); });
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
it('refreshes followed companies only after a confirmed successful follow', async () => {
  const onFollowed = vi.fn();
  mocks.resolve.mockResolvedValue({ data: { candidates: [{ source: 'workable', token: 'salla', jobCount: 2 }], unreliable: [], exhausted: false }, error: null });
  mocks.track.mockResolvedValue({ data: { company: { id: 'salla' }, crawlDispatched: false }, error: null });
  render(<CompanyLookup onFollowed={onFollowed} />); search();
  fireEvent.click(await screen.findByRole('button', { name: /Follow board/ }));
  expect(await screen.findByText(/Company followed/)).toBeVisible();
  expect(onFollowed).toHaveBeenCalledOnce();
  expect(screen.queryByText(/Board check requested/)).not.toBeInTheDocument();
});
