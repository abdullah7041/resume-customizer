// src/components/Features/ResumeUpload.jsx
import React, { useState } from 'react';
import { Upload, FileText } from 'lucide-react';

/**
 * A component dedicated to the "Resume" tab.
 * It handles file uploading and text pasting.
 *
 * @param {object} props
 * @param {Function} props.onParseResume - A function passed from the parent to process the resume.
 * @param {object|null} props.resumeData - The structured resume data from the parent.
 */
const ResumeUpload = ({ onParseResume, resumeData }) => {
  const [resumeText, setResumeText] = useState('');
  const [fileName, setFileName] = useState('');

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setFileName(file.name);
    // We pass the file object directly to the parent handler.
    onParseResume(file);
  };

  const handlePasteAndParse = () => {
    if (!resumeText.trim()) {
      // We can add a notification system later.
      alert('Please paste your resume text first.');
      return;
    }
    // We pass the raw text to the parent handler.
    onParseResume(resumeText);
  };

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-lg font-semibold text-gray-800 mb-4">
          📄 Upload or Paste Your Resume
        </label>
        
        <div className="space-y-4">
          <div>
            <input
              type="file"
              accept=".pdf,.doc,.docx,.txt"
              onChange={handleFileChange}
              className="hidden"
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
              className="flex items-center justify-center space-x-2 w-full px-6 py-4 bg-white border-2 border-dashed border-purple-300 rounded-xl hover:border-purple-500 hover:bg-purple-50 transition-all duration-200 cursor-pointer"
            >
              <Upload className="w-5 h-5 text-purple-600" />
              <span className="font-medium text-gray-700">
                {fileName ? `Selected: ${fileName}` : 'Upload Resume File'}
              </span>
            </label>
          </div>
          
          <textarea
            value={resumeText}
            onChange={(e) => setResumeText(e.target.value)}
            className="w-full h-64 p-4 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-100 transition-all duration-200 resize-none"
            placeholder="Or paste your resume text here..."
          />
        </div>
      </div>

      <button
        onClick={handlePasteAndParse}
        className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50"
        disabled={!resumeText.trim()}
      >
        <FileText className="inline mr-2" />
        Process Pasted Resume
      </button>

      {resumeData && (
        <div className="bg-gray-900 text-gray-100 p-6 rounded-xl">
          <h3 className="text-lg font-semibold mb-3 text-purple-400">Structured Resume Data</h3>
          <pre className="text-sm overflow-auto max-h-96">
            {JSON.stringify(resumeData, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

export default ResumeUpload;
