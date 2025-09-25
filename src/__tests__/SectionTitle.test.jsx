import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import SectionTitle from '../components/ui/SectionTitle.jsx';

describe('SectionTitle', () => {
  it('applies the gold shimmer styles to the heading container', () => {
    render(<SectionTitle eyebrow="Insights" title="Experience" description="Detail" />);

    const wrapper = screen.getByRole('heading', { name: 'Experience', level: 2 }).parentElement;
    expect(wrapper).toHaveClass('group/section-title');
  });

  it('uses the shimmer animation utility classes on the heading', () => {
    render(<SectionTitle eyebrow="Insights" title="Experience" />);

    const heading = screen.getByRole('heading', { name: 'Experience', level: 2 });
    expect(heading.className).toContain('motion-safe:group-hover/section-title:after:animate-[accent-shimmer_1.6s_linear]');
    expect(heading.className).toContain('motion-reduce:group-hover/section-title:after:animate-none');
  });
});
