import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import SectionTitle from '../components/ui/SectionTitle.jsx';

describe('SectionTitle', () => {
  it('applies the new panel stroke styling to the heading container', () => {
    render(<SectionTitle eyebrow="Insights" title="Experience" description="Detail" />);

    const wrapper = screen.getByRole('heading', { name: 'Experience', level: 2 }).parentElement;
    expect(wrapper).toHaveClass('group/section-title');
    expect(wrapper.className).toContain('border-[color:var(--panel-stroke)]');
  });

  it('exposes the tightened typography rhythm on the heading', () => {
    render(<SectionTitle eyebrow="Insights" title="Experience" />);

    const heading = screen.getByRole('heading', { name: 'Experience', level: 2 });
    expect(heading.className).toContain('tracking-tight');
    expect(heading.className).toContain('text-[color:var(--ink)]');
  });
});
