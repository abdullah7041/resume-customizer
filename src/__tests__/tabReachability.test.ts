import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Every tab in the config must be reachable from the UI.
 *
 * MainContent keeps three hand-maintained lists: the tab config itself, the
 * primary strip, and the secondary "More tools" list. Adding a tab to the config
 * alone compiles, type-checks, passes every existing test — and renders a tab no
 * user can ever open, because the panel that would link to it iterates the
 * secondary list rather than the config. That is exactly how the Job Feed tab
 * shipped invisible until it was opened in a browser.
 */
const SOURCE = readFileSync(
  join(__dirname, '..', 'components', 'Layout', 'MainContent.tsx'),
  'utf8',
);

function stringArray(name: string): string[] {
  const match = new RegExp(`const ${name} = \\[([^\\]]*)\\]`, 's').exec(SOURCE);
  if (!match) throw new Error(`${name} not found in MainContent.tsx`);
  return [...match[1].matchAll(/"([^"]+)"/g)].map((entry) => entry[1]);
}

function setLiteral(name: string): string[] {
  const match = new RegExp(`const ${name} = new Set\\(\\[([^\\]]*)\\]`, 's').exec(SOURCE);
  if (!match) throw new Error(`${name} not found in MainContent.tsx`);
  return [...match[1].matchAll(/"([^"]+)"/g)].map((entry) => entry[1]);
}

function configuredTabValues(): string[] {
  const match = /const getTabsConfig[\s\S]*?\n\];/.exec(SOURCE);
  if (!match) throw new Error('getTabsConfig not found in MainContent.tsx');
  return [...match[0].matchAll(/\{\s*value:\s*"([^"]+)"/g)].map((entry) => entry[1]);
}

describe('tab reachability', () => {
  it('routes every configured tab through the primary strip or More tools', () => {
    const reachable = new Set([
      ...stringArray('PRIMARY_TAB_VALUES'),
      ...stringArray('MOBILE_SECONDARY_TAB_VALUES'),
    ]);

    const orphans = configuredTabValues().filter((value) => !reachable.has(value));
    expect(orphans, `these tabs exist in the config but nothing links to them: ${orphans.join(', ')}`).toEqual([]);
  });

  it('lists no tab that the config does not define', () => {
    const configured = new Set(configuredTabValues());
    const listed = [...stringArray('PRIMARY_TAB_VALUES'), ...stringArray('MOBILE_SECONDARY_TAB_VALUES')];

    const dangling = listed.filter((value) => !configured.has(value));
    expect(dangling, `these values are linked but have no tab: ${dangling.join(', ')}`).toEqual([]);
  });

  it('exempts only tabs that something actually links to', () => {
    // RESUME_OPTIONAL_TAB_VALUES exempts a tab from the redirect back to Upload.
    // A typo there is silent in the worst way: the name matches nothing, so the
    // tab stays gated and the exemption reads as done.
    const optional = setLiteral('RESUME_OPTIONAL_TAB_VALUES');
    const secondary = new Set(stringArray('MOBILE_SECONDARY_TAB_VALUES'));

    expect(optional.length).toBeGreaterThan(0);
    const unlinked = optional.filter((value) => !secondary.has(value));
    expect(unlinked, `exempted from the resume gate but linked from nowhere: ${unlinked.join(', ')}`).toEqual([]);
  });

  it('renders a body for every secondary tab', () => {
    for (const value of stringArray('MOBILE_SECONDARY_TAB_VALUES')) {
      expect(SOURCE, `no render branch for the "${value}" tab`).toContain(`activeTab === "${value}"`);
    }
  });
});
