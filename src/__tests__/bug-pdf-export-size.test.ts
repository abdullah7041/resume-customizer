/**
 * Bug: client-side PDF fallback produced a ~15MB file with non-selectable text.
 *
 * Root cause: the fallback rasterizes the resume (html-to-image → canvas) and
 * embeds it with jsPDF `addImage`. The call omitted the `compression` argument,
 * so jsPDF stored the bitmap as raw DeviceRGB (1588x3370x3 ≈ 15MB for one A4
 * page). Passing 'FAST' applies FlateDecode; the same pixels drop to ~0.5MB
 * (the resume is ~92% white, so it deflates ~30x).
 *
 * This guards the fix at the source level: every jsPDF.addImage in the app must
 * pass a compression mode, never embed a raw bitmap again.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const SRC_DIR = resolve(__dirname, "..");

// jsPDF.addImage(imageData, format, x, y, w, h, alias?, compression?, rotation?)
// compression is the 8th positional arg and must be one of these modes.
const COMPRESSION_MODES = ["FAST", "MEDIUM", "SLOW"];

const filesWithAddImage = [
  "components/sections/TemplatesSection.tsx",
];

describe("Bug: jsPDF.addImage must compress the bitmap (no raw 15MB PDFs)", () => {
  for (const rel of filesWithAddImage) {
    const src = readFileSync(resolve(SRC_DIR, rel), "utf-8");

    // Pull out every addImage(...) call (may span lines).
    const calls = src.match(/\.addImage\(([\s\S]*?)\)/g) || [];

    it(`${rel} has at least one addImage call`, () => {
      expect(calls.length).toBeGreaterThan(0);
    });

    for (const call of calls) {
      it(`${rel}: addImage passes a compression mode`, () => {
        const hasCompression = COMPRESSION_MODES.some((m) => call.includes(`'${m}'`) || call.includes(`"${m}"`));
        expect(hasCompression, `addImage call missing compression arg:\n${call}`).toBe(true);
      });
    }
  }
});
