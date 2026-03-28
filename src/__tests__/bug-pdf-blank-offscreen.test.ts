import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('PDF off-screen blank bug', () => {
  it('TemplatesSection should strip absolute positioning before capturing HTML for Puppeteer', () => {
    const source = readFileSync(
      join(__dirname, '../components/sections/TemplatesSection.tsx'),
      'utf-8'
    );

    // After pagination and before clone.outerHTML, we MUST remove the off-screen positioning
    // so Puppeteer does not render the resume at -9999px
    const hasPositionReset = (source.includes("clone.style.position = 'static'") || source.includes("clone.style.position = ''")) 
                          && (source.includes("clone.style.left = '0'") || source.includes("clone.style.left = ''") || source.includes("clone.style.left = 'auto'"));
    
    expect(hasPositionReset).toBe(true);
  });
});
