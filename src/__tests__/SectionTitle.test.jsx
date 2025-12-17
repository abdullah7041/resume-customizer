import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import SectionTitle from '../components/ui/SectionTitle';

describe('SectionTitle', () => {
  it('applies the new panel stroke styling to the heading container', () => {
    render(<SectionTitle eyebrow="Insights" title="Experience" description="Detail" />);

    const heading = screen.getByRole('heading', { name: 'Experience', level: 2 });
    const wrapper = heading.closest('section');
    expect(wrapper?.className).toContain('rounded-card');
    expect(wrapper?.className).toContain('border-[color:var(--glass-border-strong)]');
    expect(wrapper?.className).toContain('bg-[color:color-mix');
  });

  it('exposes the tightened typography rhythm on the heading', () => {
    render(<SectionTitle eyebrow="Insights" title="Experience" />);

    const heading = screen.getByRole('heading', { name: 'Experience', level: 2 });
    expect(heading.className).toContain('tracking-tight');
    expect(heading.className).toContain('text-ink');
  });
});




