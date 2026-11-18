import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const { useAuth, getSession } = vi.hoisted(() => ({ useAuth: vi.fn(), getSession: vi.fn() }));
vi.mock('@/hooks/useAuth', () => ({ useAuth }));
vi.mock('@/services/supabase', () => ({ supabase: { auth: { getSession } } }));
import GeideaSandboxPage from '@/pages/GeideaSandboxPage';

beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState({}, '', '/dev/payments');
  useAuth.mockReturnValue({ user: { id: 'admin', app_metadata: { role: 'admin' } }, loading: false });
  getSession.mockResolvedValue({ data: { session: { access_token: 'token' } } });
  vi.stubGlobal('fetch', vi.fn());
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('GEIDEA sandbox page', () => {
  it('requires an administrator even in development', () => {
    useAuth.mockReturnValue({ user: { app_metadata: {} }, loading: false });
    render(<GeideaSandboxPage />);
    expect(screen.getByText(/restricted to administrators/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /create test checkout/i })).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('creates an Arabic sandbox checkout and provides a fixed-origin hosted payment link', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ paymentId: '00000000-0000-4000-8000-000000000001', checkoutUrl: 'https://www.ksamerchant.geidea.net/hpp/checkout/?session' })));
    render(<GeideaSandboxPage />);
    fireEvent.change(screen.getByLabelText('Checkout language'), { target: { value: 'ar' } });
    fireEvent.click(screen.getByRole('button', { name: /create test checkout/i }));
    expect(await screen.findByRole('link', { name: /open geidea checkout/i })).toHaveAttribute('href', 'https://www.ksamerchant.geidea.net/hpp/checkout/?session');
    const request = vi.mocked(fetch).mock.calls[0][1];
    expect(JSON.parse(request?.body as string)).toEqual({ action: 'create', language: 'ar' });
    expect(request?.headers).toMatchObject({ Authorization: 'Bearer token' });
    expect(screen.getByText(/no credits or pro benefits/i)).toBeInTheDocument();
  });

  it('reads server status after returning and does not infer success from the URL', async () => {
    window.history.replaceState({}, '', '/dev/payments?payment=00000000-0000-4000-8000-000000000001&status=success');
    vi.mocked(fetch).mockImplementation(async () => new Response(JSON.stringify({ paymentId: '00000000-0000-4000-8000-000000000001', status: 'pending', orderId: null, brand: null })));
    render(<GeideaSandboxPage />);
    expect(await screen.findByText('Payment status: pending')).toBeInTheDocument();
    expect(screen.queryByText('Payment status: succeeded')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /refresh status/i })).toBeInTheDocument();
  });

  it('surfaces configuration errors without claiming a payment succeeded', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ error: { status: 503, code: 'payment/disabled', message: 'Sandbox checkout is disabled' } }), { status: 503 }));
    render(<GeideaSandboxPage />);
    fireEvent.click(screen.getByRole('button', { name: /create test checkout/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Sandbox checkout is disabled');
    expect(screen.queryByRole('link', { name: /open geidea checkout/i })).not.toBeInTheDocument();
  });

  it('rejects a payment URL outside GEIDEA', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ paymentId: '00000000-0000-4000-8000-000000000001', checkoutUrl: 'https://example.org/phishing' })));
    render(<GeideaSandboxPage />);
    fireEvent.click(screen.getByRole('button', { name: /create test checkout/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid checkout response');
    expect(screen.queryByRole('link', { name: /open geidea checkout/i })).not.toBeInTheDocument();
  });
});
