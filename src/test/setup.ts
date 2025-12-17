import "@testing-library/jest-dom"; // nice matchers: toBeInTheDocument, etc.
import { vi } from "vitest";

// Mock localStorage for all tests
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => {
      const keys = Object.keys(store);
      return keys[index] || null;
    },
  };
})();

Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
  writable: true,
});

vi.mock(
  "pdfjs-dist/legacy/build/pdf.mjs",
  () => {
    const emptyPage = {
      getTextContent: vi.fn(async () => ({ items: [] })),
      cleanup: vi.fn(),
    };

    return {
      getDocument: vi.fn(() => ({
        promise: Promise.resolve({
          numPages: 0,
          getPage: vi.fn(async () => emptyPage),
          cleanup: vi.fn(),
          destroy: vi.fn(),
        }),
      })),
      GlobalWorkerOptions: {},
    };
  }
);




