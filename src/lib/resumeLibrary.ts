import { create } from 'zustand';
import type { ResumeSchema } from '@/types/resume';

export const MAX_RESUME_LIBRARY_SIZE = 5;
const DB_NAME = 'watheq-resume-library';
const STORE_NAME = 'resumes';
const ACTIVE_KEY = 'watheq:activeResumeId';

export interface ResumeLibraryInput {
  parsedResume: ResumeSchema;
  plainText: string;
  sourceFileName?: string;
  name?: string;
}

export interface ResumeLibraryEntry extends ResumeLibraryInput {
  id: string;
  name: string;
  fingerprint: string;
  createdAt: number;
  updatedAt: number;
  cachedEvidenceProfile?: unknown;
}

export function fingerprintResume(text: string): string {
  const normalized = text.normalize('NFKC').replace(/\s+/g, ' ').trim().toLocaleLowerCase();
  let hash = 2166136261;
  for (let index = 0; index < normalized.length; index += 1) {
    hash ^= normalized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function defaultResumeName(input: ResumeLibraryInput, entries: ResumeLibraryEntry[], now: number): string {
  if (input.sourceFileName?.trim() && !/^pasted (resume text|text)$/i.test(input.sourceFileName.trim())) return input.sourceFileName.trim();
  const candidate = input.parsedResume.basics?.name?.trim() || 'Resume';
  const date = new Date(now).toISOString().slice(0, 10);
  const base = `${candidate} — ${date}`;
  const duplicates = entries.filter(entry => entry.name === base || entry.name.startsWith(`${base} (`)).length;
  return duplicates ? `${base} (${duplicates + 1})` : base;
}

export function addResumeToLibrary(
  entries: ResumeLibraryEntry[],
  input: ResumeLibraryInput,
  now = Date.now(),
): { entries: ResumeLibraryEntry[]; entry: ResumeLibraryEntry } {
  const fingerprint = fingerprintResume(input.plainText);
  const existing = entries.find(entry => entry.fingerprint === fingerprint);
  if (!existing && entries.length >= MAX_RESUME_LIBRARY_SIZE) {
    throw new Error('You can save up to five resumes. Remove one before adding another.');
  }

  const entry: ResumeLibraryEntry = {
    id: existing?.id ?? `resume-${fingerprint}-${now}`,
    name: input.name?.trim() || existing?.name || defaultResumeName(input, entries, now),
    sourceFileName: input.sourceFileName,
    parsedResume: structuredClone(input.parsedResume),
    plainText: input.plainText,
    fingerprint,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    ...(existing?.cachedEvidenceProfile === undefined ? {} : { cachedEvidenceProfile: existing.cachedEvidenceProfile }),
  };
  const next = existing
    ? entries.map(current => current.id === existing.id ? entry : current)
    : [...entries, entry];
  return { entries: next, entry };
}

export function migrateLegacyResume(
  entries: ResumeLibraryEntry[],
  legacy: ResumeLibraryInput | null | undefined,
  now = Date.now(),
): ResumeLibraryEntry[] {
  if (entries.length > 0 || !legacy?.plainText || !legacy.parsedResume) return entries;
  return addResumeToLibrary(entries, legacy, now).entries;
}

export function removeResumeFromLibrary(
  entries: ResumeLibraryEntry[],
  resumeId: string,
  activeResumeId: string | null,
): { entries: ResumeLibraryEntry[]; activeResumeId: string | null } {
  const remaining = entries.filter(entry => entry.id !== resumeId);
  if (activeResumeId !== resumeId) return { entries: remaining, activeResumeId };
  const newest = [...remaining].sort((a, b) => b.updatedAt - a.updatedAt)[0];
  return { entries: remaining, activeResumeId: newest?.id ?? null };
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(
  mode: 'readonly' | 'readwrite',
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode);
      const request = operation(transaction.objectStore(STORE_NAME));
      let result: T | undefined;
      request.onsuccess = () => { result = request.result; };
      request.onerror = () => reject(request.error);
      transaction.oncomplete = () => resolve(result as T);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error ?? new Error('Resume library transaction was aborted.'));
    });
  } finally {
    database.close();
  }
}

const libraryDb = {
  getAll: () => withStore<ResumeLibraryEntry[]>('readonly', store => store.getAll()),
  put: (entry: ResumeLibraryEntry) => withStore<unknown>('readwrite', store => store.put(entry)),
  delete: (id: string) => withStore<undefined>('readwrite', store => store.delete(id) as IDBRequest<undefined>),
  clear: () => withStore<undefined>('readwrite', store => store.clear() as IDBRequest<undefined>),
};

function persistActiveId(id: string | null): void {
  if (typeof window === 'undefined') return;
  if (id) window.localStorage.setItem(ACTIVE_KEY, id);
  else window.localStorage.removeItem(ACTIVE_KEY);
}

interface ResumeLibraryState {
  entries: ResumeLibraryEntry[];
  activeResumeId: string | null;
  initialized: boolean;
  initialize: (legacy?: ResumeLibraryInput | null) => Promise<void>;
  saveResume: (input: ResumeLibraryInput) => Promise<ResumeLibraryEntry>;
  activateResume: (id: string) => void;
  renameResume: (id: string, name: string) => Promise<void>;
  removeResume: (id: string) => Promise<void>;
  clearLibrary: () => Promise<void>;
}

let initializationPromise: Promise<void> | null = null;

export const useResumeLibraryStore = create<ResumeLibraryState>((set, get) => ({
  entries: [],
  activeResumeId: null,
  initialized: false,
  initialize: async (legacy) => {
    if (get().initialized) return;
    if (typeof indexedDB === 'undefined') {
      set({ initialized: true });
      return;
    }
    if (initializationPromise) return initializationPromise;
    initializationPromise = (async () => {
      try {
        let entries = await libraryDb.getAll();
        const migrated = migrateLegacyResume(entries, legacy);
        if (migrated !== entries) {
          entries = migrated;
          await libraryDb.put(entries[0]);
        }
        const storedActive = typeof window === 'undefined' ? null : window.localStorage.getItem(ACTIVE_KEY);
        const activeResumeId = entries.some(entry => entry.id === storedActive)
          ? storedActive
          : [...entries].sort((a, b) => b.updatedAt - a.updatedAt)[0]?.id ?? null;
        persistActiveId(activeResumeId);
        set({ entries, activeResumeId, initialized: true });
      } catch (error) {
        console.warn('[resume-library] IndexedDB unavailable; keeping the current resume only.', error);
        set({ initialized: true });
      }
    })();
    try {
      await initializationPromise;
    } finally {
      initializationPromise = null;
    }
  },
  saveResume: async (input) => {
    if (initializationPromise) await initializationPromise;
    const result = addResumeToLibrary(get().entries, input);
    await libraryDb.put(result.entry);
    persistActiveId(result.entry.id);
    set({ entries: result.entries, activeResumeId: result.entry.id });
    return result.entry;
  },
  activateResume: (id) => {
    if (!get().entries.some(entry => entry.id === id)) return;
    persistActiveId(id);
    set({ activeResumeId: id });
  },
  renameResume: async (id, name) => {
    const trimmed = name.trim().slice(0, 80);
    if (!trimmed) return;
    const entry = get().entries.find(item => item.id === id);
    if (!entry) return;
    const updated = { ...entry, name: trimmed, updatedAt: Date.now() };
    await libraryDb.put(updated);
    set(state => ({ entries: state.entries.map(item => item.id === id ? updated : item) }));
  },
  removeResume: async (id) => {
    const result = removeResumeFromLibrary(get().entries, id, get().activeResumeId);
    await libraryDb.delete(id);
    persistActiveId(result.activeResumeId);
    set(result);
  },
  clearLibrary: async () => {
    await libraryDb.clear();
    persistActiveId(null);
    set({ entries: [], activeResumeId: null });
  },
}));
