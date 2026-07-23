import { afterEach, describe, expect, it, vi } from 'vitest';

describe('analytics initialization', () => {
  afterEach(() => {
    vi.doUnmock('mixpanel-browser');
    vi.doUnmock('../lib/stores/consentStore');
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it('loads Mixpanel only after analytics consent passes', async () => {
    let analyticsConsent = false;
    const moduleLoaded = vi.fn();
    const init = vi.fn();

    vi.stubEnv('VITE_MIXPANEL_TOKEN', 'test-token');
    vi.doMock('../lib/stores/consentStore', () => ({
      useConsentStore: {
        getState: () => ({ analyticsConsent }),
      },
    }));
    vi.doMock('mixpanel-browser', () => {
      moduleLoaded();
      return {
        default: {
          init,
          track: vi.fn(),
          identify: vi.fn(),
          people: { set: vi.fn() },
        },
      };
    });

    const { analytics } = await import('./analytics');

    expect(moduleLoaded).not.toHaveBeenCalled();

    await analytics.init();

    expect(moduleLoaded).not.toHaveBeenCalled();

    analyticsConsent = true;
    await analytics.init();

    expect(moduleLoaded).toHaveBeenCalledTimes(1);
    expect(init).toHaveBeenCalledWith('test-token', expect.objectContaining({
      track_pageview: true,
      persistence: 'localStorage',
      ignore_dnt: false,
    }));
  });
});
