import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const insertMock = vi.hoisted(() => vi.fn());

vi.mock('../services/supabase', () => ({
  supabase: {
    from: () => ({ insert: insertMock }),
  },
}));

vi.mock('../services/analytics', () => ({
  analytics: {
    trackPricingIntent: vi.fn(),
    trackPricingIntentPack9Sar: vi.fn(),
    trackPricingIntentMonthly29Sar: vi.fn(),
    trackWaitlistJoined: vi.fn(),
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
    i18n: { language: 'en', dir: () => 'ltr' },
  }),
}));

import { PricingWaitlistModal } from '../components/Credits/PricingWaitlistModal';
import { PricingSection } from '../components/sections/PricingSection';
import { analytics } from '../services/analytics';

const renderModal = () =>
  render(
    <PricingWaitlistModal
      isOpen
      onClose={vi.fn()}
      creditsRemaining={5}
      dismissKey="watheq:test"
      source="pricing"
    />
  );

describe('PricingWaitlistModal', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    insertMock.mockReset();
    insertMock.mockResolvedValue({ error: null });
    global.fetch = vi.fn().mockResolvedValue({ ok: true }) as unknown as typeof fetch;
  });

  it('uses pricing-waitlist language, not upgrade/early-access wording', () => {
    renderModal();

    expect(screen.getByText('Join the pricing waitlist')).toBeInTheDocument();
    expect(screen.getByText('Pricing Waitlist')).toBeInTheDocument();
    expect(
      screen.getByText("No payment required. We'll only notify you when pricing opens.")
    ).toBeInTheDocument();

    const html = document.body.innerHTML;
    expect(html).not.toMatch(/Upgrade to Premium/i);
    expect(html).not.toMatch(/Early Access/i);
    expect(html).not.toMatch(/Notify Me/i);
    expect(html).not.toMatch(/Supercharge/i);
  });

  it('does not show pricing-intent survey in the launch pricing flow', () => {
    renderModal();

    expect(screen.queryByText(/Which pricing would you consider/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/9 SAR application pack/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/29 SAR monthly/i)).not.toBeInTheDocument();
  });

  it('validates the email before submitting', async () => {
    renderModal();

    fireEvent.change(screen.getByPlaceholderText('Enter your email'), {
      target: { value: 'not-an-email' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Join pricing waitlist' }));

    expect(await screen.findByText('Please enter a valid email address')).toBeInTheDocument();
    expect(insertMock).not.toHaveBeenCalled();
  });

  it('submits a valid email and shows success', async () => {
    renderModal();

    fireEvent.change(screen.getByPlaceholderText('Enter your email'), {
      target: { value: 'sara@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Join pricing waitlist' }));

    await waitFor(() => expect(insertMock).toHaveBeenCalledTimes(1));
    // plan_type stays "pro"; pricing intent remains available as metadata but is not asked in the launch flow.
    const payload = insertMock.mock.calls[0][0];
    expect(payload.plan_type).toBe('pro');
    expect(payload.metadata.source).toBe('pricing_page');
    expect(payload.metadata.pricing_intent).toBe('not_provided');
    expect(analytics.trackPricingIntent).toHaveBeenCalledWith({
      source: 'pricing_page',
      planHint: 'pro_waitlist',
    });
    expect(await screen.findByText("You're on the list")).toBeInTheDocument();
  });

  it('opens the pricing waitlist without counting modal open as pricing intent', () => {
    render(<PricingSection />);

    fireEvent.click(screen.getByRole('button', { name: 'Join pricing waitlist' }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(analytics.trackPricingIntent).not.toHaveBeenCalled();
  });

  it('handles a duplicate email gracefully', async () => {
    insertMock.mockResolvedValue({ error: { code: '23505' } });
    renderModal();

    fireEvent.change(screen.getByPlaceholderText('Enter your email'), {
      target: { value: 'dupe@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Join pricing waitlist' }));

    expect(await screen.findByText("You're already on the waitlist!")).toBeInTheDocument();
  });
});
