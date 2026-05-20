import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import UploadCard from '../components/ui/UploadCard';

let language = 'ar';

const translations = {
  ar: {
    'common.cancel': 'إلغاء',
    'upload.card.uploadFileLabel': 'رفع ملف السيرة الذاتية',
    'upload.card.removeFileLabel': 'إزالة الملف المحدد',
    'upload.card.savedTitle': 'السيرة جاهزة ومحفوظة',
    'upload.card.readyTitle': 'جاهزة للتحضير',
    'upload.card.processingButton': 'قيد المعالجة...',
  },
};

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, fallback) => translations[language]?.[key] ?? fallback ?? key,
    i18n: {
      get language() {
        return language;
      },
      dir: () => (language === 'ar' ? 'rtl' : 'ltr'),
    },
  }),
}));

vi.mock('../services/supabase.js', () => ({
  AppError: class AppError extends Error {
    constructor({ code, message, hint }) {
      super(message);
      this.code = code;
      this.hint = hint;
    }
  },
}));

const baseProps = {
  onFileSelect: vi.fn(),
  onFileClear: vi.fn(),
  onSubmit: vi.fn(),
  onValidationError: vi.fn(),
  onTextChange: vi.fn(),
  onSaudiNationalChange: vi.fn(),
};

describe('UploadCard Arabic localization', () => {
  it('localizes selected-file state labels and accessible names', () => {
    language = 'ar';

    render(<UploadCard {...baseProps} fileName="cv.pdf" />);

    expect(screen.getByText('جاهزة للتحضير')).toBeInTheDocument();
    expect(screen.getAllByLabelText('رفع ملف السيرة الذاتية').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'إزالة الملف المحدد' })).toBeInTheDocument();
    expect(screen.queryByText('Ready to Prepare')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Upload resume file')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Remove selected file')).not.toBeInTheDocument();
  });

  it('localizes saved and processing states', () => {
    language = 'ar';
    const { rerender } = render(<UploadCard {...baseProps} fileName="cv.pdf" isSaved />);

    expect(screen.getByText('السيرة جاهزة ومحفوظة')).toBeInTheDocument();
    expect(screen.queryByText('Resume Ready & Saved')).not.toBeInTheDocument();

    rerender(<UploadCard {...baseProps} status="parsing" onCancel={vi.fn()} />);

    expect(screen.getByRole('button', { name: /قيد المعالجة/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'إلغاء' })).toBeInTheDocument();
    expect(screen.queryByText('Processing...')).not.toBeInTheDocument();
    expect(screen.queryByText('Cancel')).not.toBeInTheDocument();
  });
});
