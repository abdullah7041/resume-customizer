import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LoadingMessages } from './LoadingMessages';

describe('LoadingMessages', () => {
  it('does not distract with pro tips while optimization is running', () => {
    render(<LoadingMessages type="optimize" />);
    expect(screen.queryByText('Pro Tip')).not.toBeInTheDocument();
  });

  it('keeps tips for document rendering', () => {
    render(<LoadingMessages type="pdf" />);
    expect(screen.getByText('Pro Tip')).toBeInTheDocument();
  });
});
