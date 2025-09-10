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
    <div className="p-6 max-w-md mx-auto bg-gradient-to-r from-blue-50 to-purple-50 text-gray-700 rounded-xl shadow-lg">
      <h2 className="text-xl font-semibold mb-4">Step 1: Upload Resume</h2>
      <input type="file" onChange={handleFileChange} className="mb-4" />
<<<<<<< HEAD
      <button onClick={handleUpload} disabled={uploading} className="btn btn-primary">
=======
      <button
        type="button"
        onClick={handleUpload}
        disabled={uploading}
        className="btn-primary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
      >
>>>>>>> 7ba4af30aa9cc4773527324cfea98d50f9548f00
        {uploading ? "Uploading..." : "Upload"}
      </button>

      {url && (
        <p className="mt-4 text-sm">
          ✅ File uploaded: <a href={url} target="_blank" className="text-blue-600">View Resume</a>
        </p>
      )}
    </div>
  );
}
