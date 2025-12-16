import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDropzone } from 'react-dropzone';
import { GlassCard } from '../ui/GlassCard';
import { GlassButton } from '../ui/GlassButton';
import { Upload, FileText, X, Check, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils/cn';

interface UploadCardProps {
  onFileUpload: (file: File) => Promise<void>;
  onTextPaste: (text: string) => void;
  isProcessing?: boolean;
  uploadedFile?: { name: string; size: number } | null;
}

export function UploadCard({
  onFileUpload,
  onTextPaste,
  isProcessing,
  uploadedFile
}: UploadCardProps) {
  const { t } = useTranslation();
  const [pasteMode, setPasteMode] = useState(false);
  const [pasteText, setPasteText] = useState('');

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      await onFileUpload(acceptedFiles[0]);
    }
  }, [onFileUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    },
    maxFiles: 1,
    maxSize: 5 * 1024 * 1024, // 5MB
  });

  const handlePasteSubmit = () => {
    if (pasteText.trim()) {
      onTextPaste(pasteText);
    }
  };

  return (
    <GlassCard variant="elevated" className="w-full">
      {/* Header - Fixed alignment with flex */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-white">
            {t('sections.resume.upload.title')}
          </h3>
          <p className="text-sm text-gray-400 mt-1">
            {t('sections.resume.upload.subtitle')}
          </p>
        </div>
        {uploadedFile && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/20 rounded-lg">
            <Check className="w-4 h-4 text-emerald-400" />
            <span className="text-sm text-emerald-400">{t('sections.resume.upload.success')}</span>
          </div>
        )}
      </div>

      {/* Upload/Paste Toggle */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setPasteMode(false)}
          className={cn(
            'flex-1 py-2 rounded-lg text-sm font-medium transition-all',
            !pasteMode
              ? 'bg-emerald-600 text-white'
              : 'bg-white/5 text-gray-400 hover:bg-white/10'
          )}
        >
          <Upload className="w-4 h-4 inline-block me-2" />
          {t('common.upload')}
        </button>
        <button
          onClick={() => setPasteMode(true)}
          className={cn(
            'flex-1 py-2 rounded-lg text-sm font-medium transition-all',
            pasteMode
              ? 'bg-emerald-600 text-white'
              : 'bg-white/5 text-gray-400 hover:bg-white/10'
          )}
        >
          <FileText className="w-4 h-4 inline-block me-2" />
          {t('sections.resume.upload.paste')}
        </button>
      </div>

      {/* Content Area - Consistent height */}
      <div className="min-h-[200px]">
        {!pasteMode ? (
          /* Dropzone */
          <div
            {...getRootProps()}
            className={cn(
              'relative h-[200px] border-2 border-dashed rounded-xl transition-all cursor-pointer',
              'flex flex-col items-center justify-center gap-4',
              isDragActive
                ? 'border-emerald-500 bg-emerald-500/10'
                : 'border-white/20 hover:border-emerald-500/50 hover:bg-white/5',
              isProcessing && 'pointer-events-none opacity-50'
            )}
          >
            <input {...getInputProps()} />

            {isProcessing ? (
              <>
                <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
                <p className="text-gray-400">{t('sections.resume.upload.analyzing')}</p>
              </>
            ) : uploadedFile ? (
              <>
                <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                  <FileText className="w-6 h-6 text-emerald-400" />
                </div>
                <div className="text-center">
                  <p className="text-white font-medium">{uploadedFile.name}</p>
                  <p className="text-sm text-gray-400">
                    {(uploadedFile.size / 1024).toFixed(1)} KB
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    // Clear file logic
                  }}
                  className="absolute top-3 end-3 p-1.5 bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
                >
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </>
            ) : (
              <>
                <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center">
                  <Upload className="w-6 h-6 text-gray-400" />
                </div>
                <div className="text-center">
                  <p className="text-white">
                    {isDragActive
                      ? 'Drop your file here'
                      : t('sections.resume.upload.subtitle')
                    }
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    {t('sections.resume.upload.formats')}
                  </p>
                </div>
              </>
            )}
          </div>
        ) : (
          /* Paste Area */
          <div className="h-[200px] flex flex-col">
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={t('sections.resume.upload.pastePlaceholder')}
              className={cn(
                'flex-1 w-full p-4 rounded-xl resize-none',
                'bg-white/5 border border-white/10',
                'text-white placeholder-gray-500',
                'focus:outline-none focus:border-emerald-500/50 focus:bg-white/10',
                'transition-all'
              )}
            />
            <GlassButton
              onClick={handlePasteSubmit}
              disabled={!pasteText.trim() || isProcessing}
              isLoading={isProcessing}
              className="mt-3 w-full"
            >
              {t('sections.match.analyze')}
            </GlassButton>
          </div>
        )}
      </div>
    </GlassCard>
  );
}
