import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

vi.mock('../services/supabase', () => ({
  supabase: {
    storage: {
      from: () => ({
        upload: vi.fn(),
        getPublicUrl: vi.fn(() => ({ data: { publicUrl: '' } })),
      }),
    },
  },
}));

import ResumeUpload from '../features/ResumeUpload.jsx';

describe('ResumeUpload', () => {
  it('renders heading and upload button', () => {
    render(<ResumeUpload />);
    expect(
      screen.getByRole('heading', { name: /upload your resume/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /upload resume/i })
    ).toBeInTheDocument();
  });
});

