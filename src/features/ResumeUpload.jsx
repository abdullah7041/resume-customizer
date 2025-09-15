import { useRef, useState } from "react";
import { supabase } from "../services/supabase";

export default function ResumeUpload() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  const maxSize = 5 * 1024 * 1024; // 5MB
  const allowed = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];

  const handleFiles = (files) => {
    const selected = files?.[0];
    if (!selected) return;
    if (!allowed.includes(selected.type)) {
      setError("Only PDF or DOCX files are allowed.");
      setFile(null);
      return;
    }
    if (selected.size > maxSize) {
      setError("File must be 5MB or less.");
      setFile(null);
      return;
    }
    setError("");
    setFile(selected);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleUpload = async () => {
    if (!file) {
      setError("Select a file first.");
      return;
    }
    setUploading(true);
    setProgress(0);

    const fileExt = file.name.split(".").pop();
    const fileName = `${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("resumes")
      .upload(fileName, file, {
        onUploadProgress: (evt) =>
          setProgress((evt.loaded / evt.total) * 100),
      });

    if (uploadError) {
      setError("Upload failed.");
    } else {
      const { data } = supabase.storage
        .from("resumes")
        .getPublicUrl(fileName);
      setUrl(data.publicUrl);
      setFile(null);
    }

    setUploading(false);
  };

  return (
    <section className="card max-w-md mx-auto text-neutral-700" dir="auto">
      <h2 className="text-lg font-semibold mb-2">
        تحميل السيرة الذاتية
      </h2>
      <p className="text-sm mb-4">PDF أو DOCX حتى 5MB</p>

      <input
        id="resume-input"
        ref={inputRef}
        type="file"
        accept=".pdf,.docx"
        className="sr-only"
        onChange={(e) => handleFiles(e.target.files)}
      />

      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) =>
          (e.key === "Enter" || e.key === " ") && inputRef.current?.click()
        }
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragging(false);
        }}
        onDrop={handleDrop}
        className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-2xl cursor-pointer text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${dragging ? "bg-neutral-50" : "bg-neutral-100"}`}
      >
        <p className="text-sm">اسحب الملف هنا</p>
        <button type="button" className="btn-secondary mt-2">
          اختر ملف
        </button>
      </div>

      {file && (
        <p className="mt-2 text-sm">{file.name}</p>
      )}

      {error && (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={handleUpload}
        disabled={uploading}
        className="btn-primary w-full mt-4"
      >
        {uploading ? "جاري الرفع..." : "رفع السيرة الذاتية"}
      </button>

      {uploading && (
        <progress
          value={progress}
          max="100"
          className="w-full mt-4"
          aria-label="Upload progress"
        />
      )}

      {url && !uploading && (
        <p className="mt-4 text-sm">
          ✅ تم الرفع: <a href={url} target="_blank" rel="noopener" className="text-primary underline">عرض السيرة</a>
        </p>
      )}
    </section>
  );
}
