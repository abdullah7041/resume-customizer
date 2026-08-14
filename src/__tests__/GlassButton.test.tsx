import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { GlassButton } from '@/components/ui/GlassButton';

describe('GlassButton color system', () => {
  it('uses the emerald customer accent for secondary actions', () => {
    render(<GlassButton variant="secondary">Secondary action</GlassButton>);

    const button = screen.getByRole('button', { name: 'Secondary action' });
    expect(button.className).toContain('bg-emerald-50/80');
    expect(button.className).not.toMatch(/(?:blue|indigo|purple|sky|cyan)-/);
  });
});
