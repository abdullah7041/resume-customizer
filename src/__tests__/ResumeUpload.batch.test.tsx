import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import UploadSection from '@/components/sections/UploadSection';
import { addResumeToLibrary, useResumeLibraryStore } from '@/lib/resumeLibrary';
import { useResumeStore } from '@/lib/stores/resumeStore';
import type { ResumeSchema } from '@/types/resume';
import { parseResume } from '@/services/api.js';

vi.mock('@/services/api.js', () => ({
  parseResume: vi.fn(),
  isAuthRequiredError: (error: { status?: number }) => error?.status === 401,
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string, values?: Record<string, string | number>) =>
      (fallback ?? key).replace(/\{\{(\w+)\}\}/g, (_match, name: string) => String(values?.[name] ?? name)),
  }),
}));

const parsed = (name: string): ResumeSchema => ({ basics: { name }, work: [], education: [], skills: [], projects: [] } as ResumeSchema);
const document = (name: string, text = name) => ({ data: parsed(name), plainText: text });
const file = (name: string, type = 'application/pdf') => new File(['resume'], name, { type });
const mockParse = vi.mocked(parseResume);

// Exercise the library's real transaction completion and persistence path.
function installDatabase() {
  const persisted = new Map();
  let failNextWrite = false;
  vi.stubGlobal('indexedDB', {
    open: () => {
      const request: Record<string, unknown> = {};
      queueMicrotask(() => {
        request.result = {
          close: () => {},
          transaction: () => {
            const transaction: Record<string, unknown> = {};
            transaction.objectStore = () => ({
              getAll: () => {
                const read: Record<string, unknown> = {};
                queueMicrotask(() => {
                  read.result = [...persisted.values()];
                  (read.onsuccess as () => void)();
                  (transaction.oncomplete as () => void)();
                });
                return read;
              },
              put: (entry: { id: string }) => {
                const write: Record<string, unknown> = {};
                queueMicrotask(() => {
                  if (failNextWrite) {
                    failNextWrite = false;
                    transaction.error = new Error('Device storage unavailable');
                    (transaction.onerror as () => void)();
                  } else {
                    persisted.set(entry.id, structuredClone(entry));
                    (write.onsuccess as () => void)();
                    (transaction.oncomplete as () => void)();
                  }
                });
                return write;
              },
            });
            return transaction;
          },
        };
        (request.onsuccess as () => void)();
      });
      return request;
    },
  });
  return { persisted, failWrite: () => { failNextWrite = true; } };
}

function setup(files: File[], props = {}, method = 'picker') {
  const onToast = vi.fn();
  const onParseResume = vi.fn();
  const onBeforeParseResume = vi.fn();
  const onClear = vi.fn();
  const view = render(<UploadSection onParseResume={onParseResume} onBeforeParseResume={onBeforeParseResume} onToast={onToast} onClear={onClear} resumeDocument={{ plainText: 'active', fileName: 'active.pdf' }} {...props} />);
  if (method === 'drop') fireEvent.drop(screen.getByRole('button', { name: 'Upload resume file' }), { dataTransfer: { files } });
  else fireEvent.change(view.container.querySelector('input[type="file"]')!, { target: { files } });
  return { ...view, onToast, onParseResume, onBeforeParseResume, onClear };
}

async function submit() {
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Import selected resumes/i })); });
}

describe('device library batch import', () => {
  beforeEach(() => {
    mockParse.mockReset();
    useResumeLibraryStore.setState({ entries: [], activeResumeId: 'active', initialized: true });
    localStorage.setItem('watheq:activeResumeId', 'active');
    installDatabase();
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it('saves without changing or persisting the active ID and defaults single saves to activation', async () => {
    const saved = await useResumeLibraryStore.getState().saveResume({ parsedResume: parsed('First'), plainText: 'first' }, { activate: false });
    expect(useResumeLibraryStore.getState().activeResumeId).toBe('active');
    expect(localStorage.getItem('watheq:activeResumeId')).toBe('active');
    expect(useResumeLibraryStore.getState().entries[0].id).toBe(saved.id);
    const activated = await useResumeLibraryStore.getState().saveResume({ parsedResume: parsed('Second'), plainText: 'second' });
    expect(useResumeLibraryStore.getState().activeResumeId).toBe(activated.id);
  });

  it('activates the original resume when migrating a legacy workspace', async () => {
    useResumeLibraryStore.setState({ entries: [], activeResumeId: null, initialized: false });
    localStorage.removeItem('watheq:activeResumeId');
    await useResumeLibraryStore.getState().initialize({ parsedResume: parsed('Legacy'), plainText: 'legacy text' });
    expect(useResumeLibraryStore.getState().activeResumeId).toBe(useResumeLibraryStore.getState().entries[0].id);
  });

  it('keeps an existing active resume and its durable content unchanged on a duplicate batch save', async () => {
    const database = installDatabase();
    const active = await useResumeLibraryStore.getState().saveResume({ parsedResume: parsed('Current'), plainText: 'same text', sourceFileName: 'current.pdf' });
    const original = structuredClone(active);
    await useResumeLibraryStore.getState().saveResume({ parsedResume: parsed('Different AI parse'), plainText: 'SAME   text', sourceFileName: 'duplicate.pdf' }, { activate: false });
    expect(useResumeLibraryStore.getState().entries).toEqual([original]);
    expect(database.persisted.get(active.id)).toEqual(original);
    expect(useResumeLibraryStore.getState().activeResumeId).toBe(active.id);
  });

  it.each(['picker', 'drop'])('imports sequentially via %s and preserves the active workspace with one terminal toast', async (method) => {
    let completeFirst: (result: ReturnType<typeof document>) => void = () => {};
    mockParse.mockImplementationOnce((_input, options) => {
      options.onOcrFallback();
      return new Promise(resolve => { completeFirst = resolve; });
    }).mockResolvedValueOnce(document('Second'));
    const before = useResumeStore.getState();
    const view = setup([file('first.pdf'), file('second.md', 'text/markdown')], { isGuestMode: true }, method);
    expect(view.container.querySelector('input[type="file"]')).toHaveAttribute('multiple');
    await submit();
    expect(mockParse).toHaveBeenCalledTimes(1);
    expect(mockParse).toHaveBeenCalledWith(expect.any(File), expect.objectContaining({ guestPreview: true, signal: expect.any(AbortSignal) }));
    expect(screen.getByText(/Paste text or sign in to read scanned documents/i)).toBeInTheDocument();
    expect(view.onToast).not.toHaveBeenCalled();
    await act(async () => completeFirst(document('First')));
    await waitFor(() => expect(useResumeLibraryStore.getState().entries).toHaveLength(2));
    expect(useResumeStore.getState()).toBe(before);
    expect(useResumeLibraryStore.getState().activeResumeId).toBe('active');
    expect(localStorage.getItem('watheq:activeResumeId')).toBe('active');
    expect(view.onParseResume).not.toHaveBeenCalled();
    expect(view.onBeforeParseResume).not.toHaveBeenCalled();
    expect(view.onClear).not.toHaveBeenCalled();
    expect(view.onToast).toHaveBeenCalledTimes(1);
    expect(view.onToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Resume import complete', description: '2 saved, 0 failed, 0 skipped.' }));
  });

  it('leaves no active resume when importing into an empty workspace and deduplicates fingerprints', async () => {
    useResumeLibraryStore.setState({ activeResumeId: null });
    localStorage.removeItem('watheq:activeResumeId');
    mockParse.mockResolvedValueOnce(document('First', 'same text')).mockResolvedValueOnce(document('Duplicate', 'SAME   text'));
    const view = setup([file('first.pdf'), file('duplicate.pdf')]);
    await submit();
    expect(useResumeLibraryStore.getState().entries).toHaveLength(1);
    expect(useResumeLibraryStore.getState().activeResumeId).toBeNull();
    expect(localStorage.getItem('watheq:activeResumeId')).toBeNull();
    expect(view.onToast).toHaveBeenCalledTimes(1);
    // Reopening the device library must still wait for an explicit selection.
    useResumeLibraryStore.setState({ entries: [], activeResumeId: null, initialized: false });
    await useResumeLibraryStore.getState().initialize();
    expect(useResumeLibraryStore.getState().entries).toHaveLength(1);
    expect(useResumeLibraryStore.getState().activeResumeId).toBeNull();
    expect(localStorage.getItem('watheq:activeResumeId')).toBeNull();
  });

  it('keeps successes and continues past unsupported, oversized, parse and storage failures', async () => {
    const database = installDatabase();
    const oversized = file('large.pdf');
    Object.defineProperty(oversized, 'size', { value: 5 * 1024 * 1024 + 1 });
    mockParse.mockResolvedValueOnce(document('First')).mockRejectedValueOnce(new Error('Parse unavailable')).mockImplementationOnce(async () => {
      database.failWrite();
      return document('Storage failure');
    }).mockResolvedValueOnce(document('Last'));
    const view = setup([file('first.pdf'), file('image.png', 'image/png'), oversized, file('broken.pdf'), file('storage.pdf'), file('last.txt', 'text/plain')]);
    await submit();
    expect(mockParse).toHaveBeenCalledTimes(4);
    expect(useResumeLibraryStore.getState().entries.map(entry => entry.parsedResume.basics.name)).toEqual(['First', 'Last']);
    expect(screen.getByText(/Only PDF, DOCX, TXT, or Markdown resumes are supported/)).toBeInTheDocument();
    expect(screen.getByText(/File must be 5MB or smaller/)).toBeInTheDocument();
    expect(screen.getByText(/Parse unavailable/)).toBeInTheDocument();
    expect(screen.getByText(/Device storage unavailable/)).toBeInTheDocument();
    expect(view.onToast).toHaveBeenCalledTimes(1);
  });

  it('stops paid parsing once the five-entry cap is reached', async () => {
    let entries = [];
    for (let i = 0; i < 4; i += 1) entries = addResumeToLibrary(entries, { parsedResume: parsed(String(i)), plainText: String(i) }, i).entries;
    useResumeLibraryStore.setState({ entries });
    mockParse.mockResolvedValue(document('Fifth'));
    const view = setup([file('fifth.pdf'), file('sixth.pdf'), file('seventh.pdf')]);
    await submit();
    expect(mockParse).toHaveBeenCalledTimes(1);
    expect(useResumeLibraryStore.getState().entries).toHaveLength(5);
    expect(view.onToast).toHaveBeenCalledWith(expect.objectContaining({ description: '1 saved, 0 failed, 2 skipped.' }));
  });

  it('cancels the current file and remaining queue while keeping earlier saves', async () => {
    let finishPending: (value: ReturnType<typeof document>) => void = () => {};
    mockParse.mockResolvedValueOnce(document('First')).mockImplementationOnce(() => new Promise(resolve => { finishPending = resolve; }));
    const view = setup([file('first.pdf'), file('pending.pdf'), file('remaining.pdf')]);
    await submit();
    await waitFor(() => expect(mockParse).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await act(async () => finishPending(document('Cancelled')));
    expect(useResumeLibraryStore.getState().entries).toHaveLength(1);
    expect(mockParse).toHaveBeenCalledTimes(2);
    expect(view.onToast).toHaveBeenCalledTimes(1);
    expect(view.onToast).toHaveBeenCalledWith(expect.objectContaining({ description: '1 saved, 0 failed, 2 skipped.' }));
  });

  it('stops after auth failure and reports remaining files inline', async () => {
    mockParse.mockResolvedValueOnce(document('First')).mockRejectedValueOnce(Object.assign(new Error('Sign in required'), { status: 401 }));
    const view = setup([file('first.pdf'), file('auth.pdf'), file('skipped.pdf')]);
    await submit();
    expect(mockParse).toHaveBeenCalledTimes(2);
    expect(useResumeLibraryStore.getState().entries).toHaveLength(1);
    expect(view.onToast).toHaveBeenCalledTimes(1);
    expect(view.onToast).toHaveBeenCalledWith(expect.objectContaining({ description: '1 saved, 1 failed, 1 skipped.' }));
    expect(screen.getAllByText(/Please sign in to securely process your resume/).length).toBeGreaterThan(0);
  });
});
