import { useState } from "react";
import { supabase } from "../services/supabase";

export default function ResumeUpload() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [url, setUrl] = useState("");

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleUpload = async () => {
    if (!file) return alert("Please select a file first");
    setUploading(true);

    const fileExt = file.name.split(".").pop();
    const fileName = `${Date.now()}.${fileExt}`;

    const { error } = await supabase.storage
      .from("resumes")
      .upload(fileName, file);

    if (error) {
      console.error("Upload error:", error.message);
      alert("Upload failed.");
    } else {
      const { data } = supabase.storage.from("resumes").getPublicUrl(fileName);
      setUrl(data.publicUrl);
    }

    setUploading(false);
  };

  return (
    <div className="card max-w-md mx-auto text-neutral-700" dir="auto">
      <h2 className="text-xl font-semibold mb-4">Step 1: Upload Resume</h2>
      <label htmlFor="resume-file" className="block mb-2 font-medium">
        Select file
      </label>
      <input
        id="resume-file"
        type="file"
        onChange={handleFileChange}
        className="input-base mb-4"
      />
      <button
        type="button"
        onClick={handleUpload}
        disabled={uploading}
        className="btn-primary w-full"
      >
        {uploading ? "Uploading..." : "Upload"}
      </button>

      {url && (
        <p className="mt-4 text-sm">
          ✅ File uploaded: <a href={url} target="_blank" rel="noopener" className="text-primary underline">View resume</a>
        </p>
      )}
    </div>
  );
}
