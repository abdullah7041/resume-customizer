import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

const indexCss = readFileSync(resolve(__dirname, '../index.css'), 'utf-8');

const getCssRule = (selector: string) => {
  const match = indexCss.match(new RegExp(`${selector.replace('.', '\\.')}\\s*\\{([\\s\\S]*?)\\n\\s*\\}`));
  return match?.[1] ?? '';
};

describe('primary button style', () => {
  it('uses the quiet solid primary treatment instead of the old glossy metal gradient', () => {
    const btnMetalRule = getCssRule('.btn-metal');

    expect(btnMetalRule).toContain('background: var(--button-primary-fill);');
    expect(btnMetalRule).toContain('border-radius: var(--radius-sm);');
    expect(btnMetalRule).not.toContain('linear-gradient(180deg');
    expect(btnMetalRule).not.toContain('text-shadow');
  });
});
