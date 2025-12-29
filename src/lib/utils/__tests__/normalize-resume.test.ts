import { describe, it, expect } from 'vitest';
import { buildResumeDocument, ORDERED_SECTIONS } from '../../../../netlify/lib/normalize-resume.js';

describe('normalize-resume', () => {
    describe('buildResumeDocument', () => {
        it('handles empty input gracefully', () => {
            const result = buildResumeDocument('');
            expect(result.plainText).toBe('');
            expect(result.bullets).toEqual([]);
        });

        it('handles null/undefined input', () => {
            const result = buildResumeDocument(undefined as any);
            expect(result.plainText).toBe('');
        });

        it('normalizes Windows line endings', () => {
            const input = 'Line 1\r\nLine 2\r\nLine 3';
            const result = buildResumeDocument(input);
            expect(result.plainText).not.toContain('\r');
        });

        it('collapses multiple spaces', () => {
            const input = 'Name:    John     Doe';
            const result = buildResumeDocument(input);
            expect(result.plainText).toContain('Name: John Doe');
        });
    });

    describe('section detection', () => {
        it('detects EXPERIENCE section', () => {
            const input = `John Doe
john@email.com

EXPERIENCE
- Built stuff at Company A
- Led team at Company B`;

            const result = buildResumeDocument(input);
            const expSection = result.sections.find(s => s.id === 'experience');

            expect(expSection).toBeDefined();
            expect(expSection?.content.length).toBeGreaterThan(0);
        });

        it('detects SKILLS section with variations', () => {
            const variations = ['Skills', 'SKILLS', 'Technical Skills', 'Core Skills'];

            variations.forEach(header => {
                const input = `Name\n\n${header}\nPython, JavaScript`;
                const result = buildResumeDocument(input);
                const skillsSection = result.sections.find(s => s.id === 'skills');
                expect(skillsSection?.content.length).toBeGreaterThan(0);
            });
        });

        it('detects EDUCATION section', () => {
            const input = `Name

Education
BS Computer Science - MIT - 2020`;

            const result = buildResumeDocument(input);
            const eduSection = result.sections.find(s => s.id === 'education');
            expect(eduSection?.content).toContain('BS Computer Science - MIT - 2020');
        });

        it('handles case-insensitive section headers', () => {
            const input = `Name

professional experience
Worked at Company

PROJECTS
Built an app`;

            const result = buildResumeDocument(input);
            expect(result.sections.find(s => s.id === 'experience')?.content.length).toBeGreaterThan(0);
            expect(result.sections.find(s => s.id === 'projects')?.content.length).toBeGreaterThan(0);
        });
    });

    describe('bullet detection', () => {
        const bulletFormats = ['• Item', '- Item', '* Item', '> Item', '· Item'];

        bulletFormats.forEach(format => {
            it(`extracts "${format.charAt(0)}" bullets`, () => {
                const input = `Experience\n${format}`;
                const result = buildResumeDocument(input);
                expect(result.bullets.length).toBeGreaterThan(0);
            });
        });

        it('normalizes bullet spacing', () => {
            const input = 'Experience\n•    Led    team    of    5';
            const result = buildResumeDocument(input);
            expect(result.bullets[0]).toMatch(/Led team of 5/);
        });
    });

    describe('contact extraction', () => {
        it('captures contact info before first section header', () => {
            const input = `John Doe
john@example.com
+966 50 123 4567

Experience
Worked at company`;

            const result = buildResumeDocument(input);
            const contactSection = result.sections.find(s => s.id === 'contact');

            expect(contactSection?.content).toContain('John Doe');
            expect(contactSection?.content.some(c => c.includes('@'))).toBe(true);
        });

        it('detects Saudi phone numbers', () => {
            const input = `Name
+966501234567

Skills
Python`;

            const result = buildResumeDocument(input);
            const contact = result.sections.find(s => s.id === 'contact');
            expect(contact?.content.some(c => c.includes('966'))).toBe(true);
        });

        it('detects LinkedIn URLs', () => {
            const input = `Name
linkedin.com/in/johndoe

Experience
Work`;

            const result = buildResumeDocument(input);
            const contact = result.sections.find(s => s.id === 'contact');
            expect(contact?.content.some(c => c.includes('linkedin'))).toBe(true);
        });
    });

    describe('ordered sections', () => {
        it('exports ORDERED_SECTIONS constant', () => {
            expect(ORDERED_SECTIONS).toBeDefined();
            expect(ORDERED_SECTIONS.length).toBeGreaterThan(0);
        });

        it('includes required section IDs', () => {
            const ids = ORDERED_SECTIONS.map(s => s.id);
            expect(ids).toContain('experience');
            expect(ids).toContain('education');
            expect(ids).toContain('skills');
        });
    });
});
