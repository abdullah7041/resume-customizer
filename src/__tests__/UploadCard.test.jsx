import { render, screen } from '@testing-library/react';
import UploadCard from '../components/ui/UploadCard.jsx';

describe('UploadCard', () => {
  it('matches snapshot and exposes accessible controls', () => {
    const { container } = render(
      <UploadCard
        fileName=""
        onFileSelect={() => {}}
        onFileClear={() => {}}
        onTextChange={() => {}}
        textValue=""
        onSubmit={() => {}}
        status="idle"
        progress={0}
        error=""
        disabled={false}
      />
    );

    expect(
      screen.getByRole('button', { name: /upload resume file/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /prepare resume/i })
    ).toBeEnabled();
    expect(container).toMatchSnapshot();
  });
});
