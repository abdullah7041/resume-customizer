import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import PrimaryButton from '../components/ui/PrimaryButton.jsx';

describe('PrimaryButton', () => {
  it('applies the gradient, focus ring, and elevation tokens', () => {
    render(<PrimaryButton>Call to Action</PrimaryButton>);

    const button = screen.getByRole('button', { name: 'Call to Action' });
    expect(button.className).toContain('bg-[var(--button-primary-gradient)]');
    expect(button.className).toContain('focus-visible:ring-[color:var(--button-primary-focus)]');
    expect(button.className).toContain('shadow-[var(--button-primary-shadow)]');
  });
});
