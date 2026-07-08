import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

describe('ParsingWarningsBanner production visibility', () => {
  it('does not gate parse-quality warnings behind the Vite dev environment flag', () => {
    const bannerSource = readFileSync(
      join(__dirname, '../components/ui/ParsingWarningsBanner.tsx'),
      'utf-8'
    );
    const uploadSource = readFileSync(
      join(__dirname, '../components/sections/UploadSection.tsx'),
      'utf-8'
    );
    const mainContentSource = readFileSync(
      join(__dirname, '../components/Layout/MainContent.tsx'),
      'utf-8'
    );

    expect(bannerSource).not.toContain('import.meta.env.DEV');
    expect(uploadSource).not.toContain('import.meta.env.DEV && <ParsingWarningsBanner />');
    expect(mainContentSource).not.toContain('isDev && activeTab !== "resume" && <ParsingWarningsBanner />');
  });
});
