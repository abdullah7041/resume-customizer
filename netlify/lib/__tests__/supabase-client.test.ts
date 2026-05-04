import { afterEach, describe, expect, it, vi } from 'vitest';

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(() => ({ auth: { getUser: vi.fn() } })),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: createClientMock,
}));

const originalEnv = { ...process.env };

async function importFreshClient() {
  vi.resetModules();
  return import('../supabase-client.js');
}

describe('supabase server client', () => {
  afterEach(() => {
    process.env = { ...originalEnv };
    vi.clearAllMocks();
  });

  it('creates a client with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY', async () => {
    process.env.SUPABASE_URL = 'https://server.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
    process.env.VITE_SUPABASE_ANON_KEY = 'anon-key';

    const { getSupabaseClient } = await importFreshClient();
    const client = getSupabaseClient();

    expect(client).not.toBeNull();
    expect(createClientMock).toHaveBeenCalledWith(
      'https://server.supabase.co',
      'service-role-key',
      expect.objectContaining({
        auth: expect.objectContaining({
          autoRefreshToken: false,
          persistSession: false,
        }),
      })
    );
  });

  it('does not fall back to VITE_SUPABASE_ANON_KEY when the service role key is missing', async () => {
    process.env.SUPABASE_URL = 'https://server.supabase.co';
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    process.env.VITE_SUPABASE_ANON_KEY = 'anon-key';

    const { getSupabaseClient } = await importFreshClient();

    expect(getSupabaseClient()).toBeNull();
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it('does not fall back to VITE_SUPABASE_URL when SUPABASE_URL is missing', async () => {
    delete process.env.SUPABASE_URL;
    process.env.VITE_SUPABASE_URL = 'https://fallback.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';

    const { getSupabaseClient } = await importFreshClient();

    expect(getSupabaseClient()).toBeNull();
    expect(createClientMock).not.toHaveBeenCalled();
  });
});
