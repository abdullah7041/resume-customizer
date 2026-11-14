import { beforeEach, expect, it, vi } from 'vitest';
import { activatePrivateSession, getPrivateSessionRevision } from '@/lib/auth/privateSession';
import { exportToSupabase } from './supabaseExport';

const { getUser, from } = vi.hoisted(() => ({ getUser: vi.fn(), from: vi.fn() }));
vi.mock('./supabase.js', () => ({
  supabase: { auth: { getUser }, storage: { from } },
  AppError: class extends Error { constructor({ message, ...fields }) { super(message); Object.assign(this, fields); } },
}));

beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); activatePrivateSession('a', () => {}); });

it('rejects an export whose originating account changed while HTML was rendering', async () => {
  const expectedSessionRevision = getPrivateSessionRevision();
  activatePrivateSession('b', () => {});
  getUser.mockResolvedValueOnce({ data: { user: { id: 'b' } }, error: null });
  await expect(exportToSupabase({ htmlContent: '<html>Private A resume</html>', expectedSessionRevision }))
    .rejects.toMatchObject({ code: 'auth/session-changed', cancelled: true });
  expect(from).not.toHaveBeenCalled();
});
