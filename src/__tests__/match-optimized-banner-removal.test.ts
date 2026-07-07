import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

describe('optimized resume match banner removal', () => {
  it('does not ship the post-match optimized resume banner copy', () => {
    const matchSection = readFileSync(
      join(__dirname, '../components/sections/MatchSection.tsx'),
      'utf-8'
    );
    const enLocale = readFileSync(
      join(__dirname, '../locales/en/sections/match.json'),
      'utf-8'
    );
    const arLocale = readFileSync(
      join(__dirname, '../locales/ar/sections/match.json'),
      'utf-8'
    );

    expect(matchSection).not.toContain('optimizedBanner');
    expect(matchSection).not.toContain('Analyzing OPTIMIZED resume');
    expect(enLocale).not.toContain('optimizedBanner');
    expect(arLocale).not.toContain('optimizedBanner');
  });
});
