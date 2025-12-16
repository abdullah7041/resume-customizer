import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useDropzone } from 'react-dropzone';
import { GlassCard } from '../ui/GlassCard';
import { GlassButton } from '../ui/GlassButton';
import {
  Files,
  Upload,
  FileText,
  CheckCircle,
  XCircle,
  Loader2,
  Download
} from 'lucide-react';
import { cn } from '../../lib/utils/cn';

interface FileAnalysis {
  id: string;
  name: string;
  status: 'pending' | 'processing' | 'complete' | 'failed';
  score?: number;
  error?: string;
}

interface BulkAnalysisSectionProps {
  onAnalyze: (files: File[]) => Promise<void>;
  results: FileAnalysis[];
  isProcessing: boolean;
}

export function BulkAnalysisSection({
  onAnalyze,
  results,
  isProcessing,
}: BulkAnalysisSectionProps) {
  const { t } = useTranslation();
  const [files, setFiles] = useState<File[]>([]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFiles(prev => [...prev, ...acceptedFiles].slice(0, 10));
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    },
    maxFiles: 10,
  });

  const handleAnalyze = () => {
    if (files.length > 0) {
      onAnalyze(files);
    }
  };

  const getStatusIcon = (status: FileAnalysis['status']) => {
    switch (status) {
      case 'pending':
        return <FileText className="w-4 h-4 text-gray-400" />;
      case 'processing':
        return <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />;
      case 'complete':
        return <CheckCircle className="w-4 h-4 text-emerald-400" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-400" />;
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Upload Section */}
      <GlassCard variant="elevated">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center">
            <Files className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">
              {t('sections.bulkAnalysis.upload.title')}
            </h3>
            <p className="text-sm text-gray-400">
              {t('sections.bulkAnalysis.upload.subtitle')}
            </p>
          </div>
        </div>

        <div
          {...getRootProps()}
          className={cn(
            'border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer',
            isDragActive
              ? 'border-indigo-500 bg-indigo-500/10'
              : 'border-white/20 hover:border-indigo-500/50'
          )}
        >
          <input {...getInputProps()} />
          <Upload className="w-10 h-10 mx-auto mb-3 text-gray-400" />
          <p className="text-white mb-1">
            {isDragActive ? 'Drop files here' : t('sections.bulkAnalysis.upload.subtitle')}
          </p>
          <p className="text-sm text-gray-500">
            {t('sections.bulkAnalysis.upload.limit')}
          </p>
        </div>

        {/* File List */}
        {files.length > 0 && (
          <div className="mt-4 space-y-2">
            {files.map((file, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-3 bg-white/5 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <FileText className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-white truncate max-w-[200px]">
                    {file.name}
                  </span>
                </div>
                <button
                  onClick={() => setFiles(files.filter((_, idx) => idx !== i))}
                  className="text-gray-500 hover:text-red-400"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        <GlassButton
          onClick={handleAnalyze}
          disabled={files.length === 0 || isProcessing}
          isLoading={isProcessing}
          className="w-full mt-4"
        >
          Analyze {files.length} file{files.length !== 1 ? 's' : ''}
        </GlassButton>
      </GlassCard>

      {/* Results Section */}
      <GlassCard variant="elevated">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white">
            {t('sections.bulkAnalysis.results.title')}
          </h3>
          {results.some(r => r.status === 'complete') && (
            <GlassButton
              variant="secondary"
              size="sm"
              leftIcon={<Download className="w-4 h-4" />}
            >
              {t('sections.bulkAnalysis.export.csv')}
            </GlassButton>
          )}
        </div>

        {results.length === 0 ? (
          <div className="py-16 text-center text-gray-500">
            <Files className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Upload files to see results</p>
          </div>
        ) : (
          <div className="space-y-3">
            {results.map((result) => (
              <div
                key={result.id}
                className={cn(
                  'flex items-center justify-between p-4 rounded-xl border transition-all',
                  result.status === 'complete'
                    ? 'bg-emerald-500/10 border-emerald-500/20'
                    : result.status === 'failed'
                    ? 'bg-red-500/10 border-red-500/20'
                    : 'bg-white/5 border-white/10'
                )}
              >
                <div className="flex items-center gap-3">
                  {getStatusIcon(result.status)}
                  <span className="text-white">{result.name}</span>
                </div>
                {result.status === 'complete' && result.score !== undefined && (
                  <span className={cn(
                    'text-lg font-bold',
                    result.score >= 80 ? 'text-emerald-400' :
                    result.score >= 60 ? 'text-amber-400' : 'text-red-400'
                  )}>
                    {result.score}%
                  </span>
                )}
                {result.status === 'failed' && (
                  <span className="text-sm text-red-400">{result.error}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
