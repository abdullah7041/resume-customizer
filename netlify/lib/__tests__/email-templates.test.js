import { describe, expect, it } from 'vitest';

import { emailTemplates } from '../email-templates.js';

describe('emailTemplates escaping', () => {
  it('escapes user-controlled names in HTML output', () => {
    const html = emailTemplates.creditsRefreshed.en.html('<b>Alice</b>', 20);

    expect(html).toContain('&lt;b&gt;Alice&lt;/b&gt;');
    expect(html).not.toContain('<strong><b>Alice</b></strong>');
  });
});
