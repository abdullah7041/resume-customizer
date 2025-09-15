import { useRef, useState } from 'react';
import { supabase } from '../services/supabase';

/**
 * Uploads a resume file to Supabase storage.
 * Provides drag-and-drop and progress feedback.
 */
export default function ResumeUpload() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  const allowed = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];
  const maxSize = 5 * 1024 * 1024; // 5MB

  const handleFiles = (files) => {
    const selected = files?.[0];
    if (!selected) return;
    if (!allowed.includes(selected.type)) {
      setError('Only PDF or DOCX files are allowed.');
      setFile(null);
      return;
    }
    if (selected.size > maxSize) {
      setError('File must be 5MB or less.');
      setFile(null);
      return;
    }
    setError('');
    setFile(selected);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Select a file first.');
      return;
    }
    setUploading(true);
    setProgress(0);

    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('resumes')
      .upload(fileName, file, {
        onUploadProgress: (evt) =>
          setProgress((evt.loaded / evt.total) * 100),
      });

    if (uploadError) {
      setError('Upload failed.');
    } else {
      const { data } = supabase.storage.from('resumes').getPublicUrl(fileName);
      setUrl(data.publicUrl);
      setFile(null);
    }

    setUploading(false);
  };

  return (
    <section className="card max-w-lg mx-auto space-y-4 text-neutral-700">
      <h2 className="text-xl font-semibold text-center text-primary">Upload Your Resume</h2>
      <input
        ref={inputRef}
        id="resume-input"
        type="file"
        accept=".pdf,.docx"
        className="sr-only"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => ['Enter', ' '].includes(e.key) && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragging(false);
        }}
        onDrop={handleDrop}
        className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-2xl cursor-pointer text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${dragging ? 'bg-neutral-50' : 'bg-neutral-100'}`}
      >
        <p className="text-sm">PDF or DOCX up to 5MB</p>
        <span className="btn-secondary mt-2">Choose File</span>
      </div>
      {file && <p className="text-sm text-center">{file.name}</p>}
      {error && (
        <p className="text-sm text-red-600 text-center" role="alert">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={handleUpload}
        disabled={uploading}
        className="btn-primary w-full disabled:opacity-50"
      >
        {uploading ? 'Uploading...' : 'Upload Resume'}
      </button>
      {uploading && (
        <progress
          value={progress}
          max="100"
          className="w-full"
          aria-label="Upload progress"
        />
      )}
      {url && !uploading && (
        <p className="text-sm text-center">
          ✅ Upload complete: <a href={url} target="_blank" rel="noopener" className="text-primary underline">View resume</a>
        </p>
      )}
    </section>
  );
}
