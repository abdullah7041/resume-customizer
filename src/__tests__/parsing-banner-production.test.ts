import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

describe('ParsingWarningsBanner production visibility', () => {
  it('does not gate parse-quality warnings behind the Vite dev environment flag', () => {
    const source = readFileSync(
      join(__dirname, '../components/ui/ParsingWarningsBanner.tsx'),
      'utf-8'
    );

    expect(source).not.toContain('import.meta.env.DEV');
  });
});
