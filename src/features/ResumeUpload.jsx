import { useCallback, useEffect, useState } from "react";
import UploadCard from "../components/ui/UploadCard.jsx";
import { supabase } from "../services/supabase";

const ACCEPTED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export default function ResumeUpload({ onParseResume, resumeData, onToast }) {
  const [file, setFile] = useState(null);
  const [textValue, setTextValue] = useState("");
  const [status, setStatus] = useState("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    if (resumeData && !textValue) {
      setTextValue(resumeData);
    }
  }, [resumeData, textValue]);

  const resetState = useCallback(() => {
    setFile(null);
    setStatus("idle");
    setProgress(0);
    setError("");
  }, []);

  const handleFileSelect = useCallback(
    (selectedFile) => {
      if (!selectedFile) return;
      if (!ACCEPTED_TYPES.includes(selectedFile.type)) {
        const message = "Only PDF or DOCX files are supported.";
        setError(message);
        onToast?.({
          type: "warning",
          title: "Unsupported file",
          description: message,
        });
        return;
      }
      if (selectedFile.size > MAX_BYTES) {
        const message = "File must be 5MB or smaller.";
        setError(message);
        onToast?.({
          type: "warning",
          title: "File too large",
          description: message,
        });
        return;
      }
      setError("");
      setFile(selectedFile);
    },
    [onToast]
  );

  const handleSubmit = useCallback(async () => {
    if (!file && !textValue.trim()) {
      const message = "Add a file or paste your resume text.";
      setError(message);
      onToast?.({
        type: "warning",
        title: "Resume missing",
        description: message,
      });
      return;
    }

    try {
      setError("");
      setProgress(0);

      if (file) {
        setStatus("uploading");
        const extension = file.name.split(".").pop() || "pdf";
        const baseName = file.name.replace(/\.[^.]+$/, "");
        const sanitizedBase = baseName.replace(/[^a-z0-9]/gi, "-").toLowerCase();
        const fileName = `${Date.now()}-${sanitizedBase}.${extension}`;

        const { data: { user } } = await supabase.auth.getUser();
if (!user) {
  throw new Error("You must be signed in to upload a resume.");
}

const filePath = `${user.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("resumes")
          .upload(filePath, file, {
            cacheControl: "3600",
            upsert: false,
            onUploadProgress: ({ loaded, total }) => {
              if (!total) return;
              const percent = Math.round((loaded / total) * 60);
              setProgress(percent);
            },
          });

        if (uploadError) {
          throw uploadError;
        }
        // private bucket => signed URL
        const { error: signedErr } = await supabase.storage
          .from("resumes")
          .createSignedUrl(filePath, 60 * 60);

        if (signedErr) throw signedErr;

        setProgress(70);
        onToast?.({
          type: "success",
          title: "File uploaded",
          description: "Resume stored securely. Parsing next…",
        });
      }

      setStatus("parsing");
      setProgress((prev) => Math.max(prev, 80));
      const payload = file || textValue;
      const parsed = await onParseResume?.(payload);
      setProgress(100);
      setStatus("success");
      if (!file && parsed) {
        setTextValue(parsed);
      }
      setTimeout(() => {
        setStatus("idle");
        setProgress(0);
      }, 900);
    } catch (submissionError) {
      const message =
        submissionError?.message || "We could not prepare your resume.";
      setStatus("error");
      setError(message);
      onToast?.({
        type: "danger",
        title: "Upload failed",
        description: message,
      });
    }
  }, [file, onParseResume, onToast, textValue]);

  return (
    <div className="space-y-6">
      <UploadCard
        fileName={file?.name || ""}
        onFileSelect={handleFileSelect}
        onFileClear={() => {
          resetState();
          setTextValue("");
        }}
        onTextChange={setTextValue}
        textValue={textValue}
        onSubmit={handleSubmit}
        status={status}
        progress={progress}
        error={error}
        disabled={status === "uploading" || status === "parsing"}
      />
    </div>
  );
}
