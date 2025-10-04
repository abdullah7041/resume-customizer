import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import PrimaryButton from '../components/ui/PrimaryButton.jsx';

describe('PrimaryButton', () => {
  it('exposes the gold shimmer animation on hover and focus-visible', () => {
    render(<PrimaryButton>Call to Action</PrimaryButton>);

    const button = screen.getByRole('button', { name: 'Call to Action' });
    expect(button.className).toContain('focus-visible:ring-[color:var(--accent)]');
    expect(button.className).toContain('motion-safe:hover:before:animate-[accent-shimmer_1.4s_linear]');
    expect(button.className).toContain('motion-reduce:hover:before:animate-none');
  });
});
