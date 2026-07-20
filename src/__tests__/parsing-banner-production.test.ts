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

  it('keeps the full-width placement contract at both production mounts', () => {
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

    expect(bannerSource).toContain('className?: string');
    expect(bannerSource).toContain("cn('w-full animate-in fade-in duration-300', className)");
    expect(bannerSource).not.toContain('max-w-5xl');
    expect(bannerSource).not.toContain('mx-auto');
    expect(bannerSource).not.toContain('slide-in-from-top-4');
    expect(uploadSource).toContain('<ParsingWarningsBanner className="mb-4" />');
    expect(mainContentSource).toContain('<ParsingWarningsBanner className="mb-4" />');
  });
});
