// src/components/Features/ResumeUpload.jsx
import React, { useState } from 'react';
import { Upload, FileText } from 'lucide-react';

/**
 * A component for the "Resume" tab.
 * It handles both file upload and text pasting for the resume.
 *
 * @param {object} props
 * @param {Function} props.onParseResume - Function passed from the parent (App.jsx) to trigger the API call.
 * @param {object|null} props.resumeData - The parsed resume data from the parent, to display as feedback.
 */
const ResumeUpload = ({ onParseResume, resumeData }) => {
  const [resumeText, setResumeText] = useState('');
  const [fileName, setFileName] = useState('');

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setFileName(file.name);
      // Pass the file object directly to the parent handler.
      onParseResume(file);
    }
  };

  const handleProcessText = () => {
    if (!resumeText.trim()) {
      alert('Please paste your resume text before processing.');
      return;
    }
    // Pass the raw text to the parent handler.
    onParseResume(resumeText);
  };
  
  const canProcess = resumeText.trim().length > 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <label className="block text-lg font-semibold text-gray-800 mb-4">
          📄 Upload or Paste Your Resume
        </label>
        
        <div className="space-y-4">
          <input
            type="file"
            accept=".pdf,.doc,.docx,.txt"
            onChange={handleFileChange}
            className="hidden"
            id="file-upload"
          />
          <label
            htmlFor="file-upload"
            className="flex items-center justify-center space-x-3 w-full px-6 py-4 bg-white border-2 border-dashed border-purple-300 rounded-xl hover:border-purple-500 hover:bg-purple-50 transition-all duration-200 cursor-pointer"
          >
            <Upload className="w-6 h-6 text-purple-600" />
            <span className="font-medium text-gray-700">
              {fileName || 'Upload Resume File (.pdf, .docx, .txt)'}
            </span>
          </label>
          
          <div className="text-center text-gray-500 font-semibold">OR</div>

          <textarea
            value={resumeText}
            onChange={(e) => setResumeText(e.target.value)}
            className="w-full h-64 p-4 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-100 transition-all duration-200 resize-none"
            placeholder="Paste your resume text here..."
          />
        </div>
      </div>

      <button
        onClick={handleProcessText}
        disabled={!canProcess}
        className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <FileText className="inline mr-2" />
        Process Pasted Text
      </button>

      {resumeData && (
        <div className="bg-gray-900 text-gray-100 p-6 rounded-xl">
          <h3 className="text-lg font-semibold mb-3 text-purple-400">Successfully Parsed Resume Data:</h3>
          <pre className="text-sm overflow-auto max-h-64 whitespace-pre-wrap">
            {JSON.stringify(resumeData, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

export default ResumeUpload;

