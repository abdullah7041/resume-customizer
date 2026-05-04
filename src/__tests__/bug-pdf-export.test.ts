/**
 * Bug 3: PDF downloads without real data (optimizations lost)
 *
 * Root cause: MainContent.tsx — the export paths were passing raw `resumeData` instead of `mergedResume`
 *
 * This test verifies the actual source code uses the correct pattern: `mergedResume || resumeData`
 * in BOTH export paths (Supabase upload and print fallback).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Bug 3 – PDF export uses merged resume data', () => {
    it('MainContent.tsx Supabase export path uses mergedResume || resumeData', () => {
        // Read actual source code to verify the fix
        const mainContentPath = join(__dirname, '../components/Layout/MainContent.tsx');
        const source = readFileSync(mainContentPath, 'utf-8');

        // Find the Supabase export path (around line 753)
        // Should contain: resumeDocument: mergedResume || resumeData
        const supabaseExportMatch = source.match(/const htmlContent = await exportResumeToPdf\(\{[\s\S]{0,500}?resumeDocument:\s*(mergedResume\s*\|\|\s*resumeData)/);

        expect(supabaseExportMatch).toBeTruthy();
        expect(supabaseExportMatch?.[1]).toBe('mergedResume || resumeData');
    });

    it('MainContent.tsx fallback export path MUST also use mergedResume || resumeData', () => {
        // Read actual source code to verify the fix
        const mainContentPath = join(__dirname, '../components/Layout/MainContent.tsx');
        const source = readFileSync(mainContentPath, 'utf-8');

        // Find the fallback export path (around line 799)
        // Should contain: resumeDocument: mergedResume || resumeData (not just resumeData)
        const fallbackExportMatch = source.match(/Fallback to print dialog[\s\S]{0,500}?await exportResumeToPdf\(\{[\s\S]{0,500}?resumeDocument:\s*(mergedResume\s*\|\|\s*resumeData)/);

        expect(fallbackExportMatch).toBeTruthy();
        expect(fallbackExportMatch?.[1]).toBe('mergedResume || resumeData');
    });

    it('MainContent.tsx does NOT use bare resumeData in export paths', () => {
        const mainContentPath = join(__dirname, '../components/Layout/MainContent.tsx');
        const source = readFileSync(mainContentPath, 'utf-8');

        // Search for the bug pattern: resumeDocument: resumeData (without || mergedResume)
        // This regex looks for resumeDocument followed by just resumeData (not mergedResume || resumeData)
        const bugPattern = /resumeDocument:\s*resumeData(?!\s*\|\|)/;
        const hasBug = bugPattern.test(source);

        expect(hasBug).toBe(false);
    });

    it('signed-out Supabase export falls through to print fallback instead of returning early', () => {
        const mainContentPath = join(__dirname, '../components/Layout/MainContent.tsx');
        const source = readFileSync(mainContentPath, 'utf-8');

        expect(source).toContain('const canSaveToSupabase = exportMethod === "supabase" && isSupabaseExportAvailable() && Boolean(user)');
        expect(source).toContain('if (canSaveToSupabase)');

        const signedOutBranch = source.match(/if \(exportMethod === "supabase" && isSupabaseExportAvailable\(\) && !user\) \{[\s\S]{0,500}?\n\s*\}/);
        expect(signedOutBranch).toBeTruthy();
        expect(signedOutBranch?.[0]).not.toContain('return;');
    });
});
