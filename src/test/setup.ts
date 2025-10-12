import "@testing-library/jest-dom"; // nice matchers: toBeInTheDocument, etc.
import { vi } from "vitest";

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
  },
  { virtual: true }
);
