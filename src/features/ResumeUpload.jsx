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
    <div className="p-6 max-w-md mx-auto bg-white shadow rounded">
      <h2 className="text-xl font-semibold mb-4">Step 1: Upload Resume</h2>
      <input type="file" onChange={handleFileChange} className="mb-4" />
      <button onClick={handleUpload} disabled={uploading} className="btn">
        {uploading ? "Uploading..." : "Upload"}
      </button>

      {url && (
        <p className="mt-4 text-sm text-gray-600">
          ✅ File uploaded: <a href={url} target="_blank" className="text-blue-600">View Resume</a>
        </p>
      )}
    </div>
  );
}
