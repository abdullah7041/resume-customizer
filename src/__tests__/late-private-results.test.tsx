import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { InterviewSection } from '@/components/sections/InterviewSection';
import { Vision2030Section } from '@/components/Vision2030/Vision2030Section';
import { analyzeVision2030 } from '@/services/api';
import { activatePrivateSession, privateStorage } from '@/lib/auth/privateSession';

vi.mock('@/services/api', () => ({ analyzeVision2030: vi.fn() }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'owner-a' } }) }));
vi.mock('@/hooks/useUserCredits', () => ({ useUserCredits: () => ({ credits: 20, isLoading: false, refetch: vi.fn() }) }));
vi.mock('@/lib/auth/authHeaders', () => ({ getAuthHeaders: async () => ({}) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string, fallback?: string) => typeof fallback === 'string' ? fallback : key, i18n: { language: 'en' } }) }));
vi.mock('@/components/Credits/ConfirmActionModal', () => ({ ConfirmActionModal: ({ isOpen, onConfirm }: { isOpen: boolean; onConfirm: () => void }) => isOpen ? <button onClick={onConfirm}>Confirm</button> : null }));

beforeEach(() => { localStorage.clear(); activatePrivateSession('owner-a', () => {}); });

it('discards a late interview response after account change and unmount', async () => {
  let finish!: (response: Response) => void;
  const fetchMock = vi.fn(() => new Promise<Response>(resolve => { finish = resolve; }));
  vi.stubGlobal('fetch', fetchMock);
  const onUpdate = vi.fn();
  const view = render(<InterviewSection resumeText="Private A resume" jobDescription="Private A job" onUpdate={onUpdate} />);
  fireEvent.click(screen.getByRole('button', { name: /generateBehavioral/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
  view.unmount();
  activatePrivateSession('owner-b', () => {});
  await act(async () => { finish(new Response(JSON.stringify({ questions: ['Private A question'] }))); });
  expect(privateStorage.getItem('watheq:interviewQuestions')).toBeNull();
  expect(onUpdate).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
});

it('discards a late Vision response without changing the next owner’s loading state', async () => {
  let finish!: (value: object) => void;
  vi.mocked(analyzeVision2030).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const view = render(<Vision2030Section resumeText="Private A resume" />);
  fireEvent.click(screen.getByRole('button', { name: /Analyze|vision2030.section.analyze/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
  await waitFor(() => expect(analyzeVision2030).toHaveBeenCalled());
  view.unmount();
  activatePrivateSession('owner-b', () => {});
  privateStorage.setItem('watheq:vision2030Analyzing', 'B pending');
  await act(async () => { finish({ overallScore: 80 }); });
  expect(privateStorage.getItem('watheq:vision2030Analysis')).toBeNull();
  expect(privateStorage.getItem('watheq:vision2030Analyzing')).toBe('B pending');
});
