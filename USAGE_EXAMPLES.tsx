/**
 * Example usage of DeepSeek OCR and Batch API
 * Copy these examples into your code to get started
 */

// ============================================
// Example 1: Basic OCR Usage (Automatic)
// ============================================

import { parseResume } from './services/api.js';

async function uploadScannedResume(file) {
  try {
    const result = await parseResume(file);
    
    // Check if OCR was used
    if (result.usedOCR) {
      console.log('✨ OCR was used to extract text');
      console.log('Structured data:', result.structured);
    } else {
      console.log('Standard extraction was sufficient');
    }
    
    // Access the plain text
    console.log('Resume text:', result.plainText);
    console.log('Sections:', result.sections);
    console.log('Bullets:', result.bullets);
    
    return result;
  } catch (error) {
    console.error('Parsing failed:', error.message);
  }
}

// ============================================
// Example 2: Batch Processing - Parse + Match + Optimize
// ============================================

import { processResumeBatch } from './services/api.js';

async function processResumeWithJob(resumeFile, jobDescription) {
  try {
    const result = await processResumeBatch({
      resumeInput: resumeFile, // Can be File or string
      jobDescription: jobDescription,
      mode: 'auto', // or 'conservative', 'aggressive'
      onProgress: (completed, total) => {
        const percent = (completed / total) * 100;
        console.log(`Progress: ${percent}%`);
        // Update UI progress bar here
      }
    });
    
    // Check what completed successfully
    if (result.parsed) {
      console.log('✅ Parse succeeded');
      console.log('Used OCR:', result.usedOCR);
      console.log('Resume data:', result.parsed.document);
    }
    
    if (result.match) {
      console.log('✅ Match analysis succeeded');
      console.log('Score:', result.match.score);
      console.log('Missing keywords:', result.match.missingKeywords);
    }
    
    if (result.optimized) {
      console.log('✅ Optimization succeeded');
      console.log('Suggestion cards:', result.optimized.cards);
      console.log('Keywords to add:', result.optimized.keywords.add);
    }
    
    // Handle any errors
    if (result.errors.length > 0) {
      console.error('❌ Some tasks failed:');
      result.errors.forEach(err => {
        console.error(`  ${err.type}: ${err.error}`);
      });
    }
    
    return result;
  } catch (error) {
    console.error('Batch processing failed:', error.message);
  }
}

// ============================================
// Example 3: Custom Batch Request
// ============================================

import { batchProcess } from './services/api.js';

async function customBatchRequest(resumeText, jobText) {
  const tasks = [
    {
      id: 'parse-task',
      type: 'parse',
      payload: {
        kind: 'text',
        value: resumeText
      }
    },
    {
      id: 'match-task',
      type: 'match',
      payload: {
        resumeText: resumeText,
        jobDesc: jobText
      }
    },
    {
      id: 'optimize-task',
      type: 'optimize',
      payload: {
        resumeText: resumeText,
        jobDesc: jobText,
        mode: 'aggressive'
      }
    },
    {
      id: 'questions-task',
      type: 'predict-questions',
      payload: {
        resumeText: resumeText,
        jobDescription: jobText
      }
    }
  ];
  
  try {
    const result = await batchProcess(tasks, {
      concurrency: 2, // Process 2 at a time
      continueOnError: true // Don't stop on first error
    });
    
    console.log('Summary:', result.summary);
    // { total: 4, successful: 3, failed: 1 }
    
    // Process each result
    result.results.forEach(taskResult => {
      if (taskResult.status === 'success') {
        console.log(`✅ ${taskResult.id}:`, taskResult.data);
      } else {
        console.error(`❌ ${taskResult.id}:`, taskResult.error);
      }
    });
    
    return result;
  } catch (error) {
    console.error('Batch request failed:', error.message);
  }
}

// ============================================
// Example 4: React Component with OCR Badge
// ============================================

import { useState } from 'react';
import OcrBadge from './components/ui/OcrBadge';
import { parseResume } from './services/api';

function ResumeUploadComponent() {
  const [resumeData, setResumeData] = useState(null);
  const [usedOCR, setUsedOCR] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setLoading(true);
    try {
      const result = await parseResume(file);
      setResumeData(result);
      setUsedOCR(result.usedOCR || false);
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div>
      <input 
        type="file" 
        onChange={handleFileUpload}
        accept=".pdf,.docx,image/*"
        disabled={loading}
      />
      
      {loading && <p>Processing...</p>}
      
      {resumeData && (
        <div>
          <h2>Resume Parsed Successfully</h2>
          {usedOCR && (
            <div>
              <OcrBadge />
              <p className="text-sm text-gray-400 mt-2">
                AI OCR was used to extract text from your image/scanned document
              </p>
            </div>
          )}
          <pre>{JSON.stringify(resumeData, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

// ============================================
// Example 5: Rate Limiting (Backend)
// ============================================

import { RateLimiter, withRetry, callDeepSeekWithRetry } from './netlify/lib/rate-limiter';

// Create a rate limiter instance
const deepseekLimiter = new RateLimiter({
  maxConcurrent: 2,
  minDelayBetweenRequestsMs: 1000, // 1 second between requests
  maxRequestsPerMinute: 10
});

// Use with DeepSeek API calls
async function extractWithRateLimit(imageData: ArrayBuffer) {
  return await callDeepSeekWithRetry(
    async () => {
      // Your DeepSeek API call here
      const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [/* ... */]
        })
      });
      
      if (!response.ok) {
        const error: any = new Error('DeepSeek request failed');
        error.status = response.status;
        throw error;
      }
      
      return await response.json();
    },
    {
      rateLimiter: deepseekLimiter,
      retryOptions: {
        maxRetries: 2,
        initialDelayMs: 2000,
        retryableStatusCodes: new Set([429, 500, 502])
      }
    }
  );
}

// Monitor rate limiter stats
setInterval(() => {
  const stats = deepseekLimiter.getStats();
  console.log('[RateLimiter Stats]', {
    active: stats.activeRequests,
    queued: stats.queuedRequests,
    lastMinute: stats.requestsInLastMinute
  });
}, 5000);

// ============================================
// Example 6: Error Handling Best Practices
// ============================================

import { AppError } from './services/supabase.js';

async function robustResumeProcessing(file, jobDescription) {
  try {
    // Parse resume
    const parseResult = await parseResume(file).catch(err => {
      throw new AppError({
        code: 'parse/failed',
        message: 'Could not extract text from resume',
        hint: err.message.includes('OCR') 
          ? 'DeepSeek OCR service is unavailable. Try a text-based PDF.'
          : 'Try a different file format (PDF or DOCX)'
      });
    });
    
    // Batch process if job description exists
    if (jobDescription) {
      const batchResult = await processResumeBatch({
        resumeInput: parseResult.plainText,
        jobDescription,
        mode: 'auto'
      }).catch(err => {
        // Log error but continue with parse result
        console.error('Batch processing failed:', err);
        return null;
      });
      
      if (batchResult) {
        return {
          resume: parseResult,
          match: batchResult.match,
          optimization: batchResult.optimized,
          usedOCR: parseResult.usedOCR || batchResult.usedOCR
        };
      }
    }
    
    // Return just parse result if batch failed or no job description
    return {
      resume: parseResult,
      usedOCR: parseResult.usedOCR
    };
    
  } catch (error) {
    // Categorize errors
    if (error instanceof AppError) {
      // Known error with user-friendly message
      console.error(`[${error.code}] ${error.message}`);
      throw error;
    } else if (error.name === 'AbortError') {
      // Timeout error
      throw new AppError({
        code: 'request/timeout',
        message: 'Request took too long',
        hint: 'Try again in a few seconds'
      });
    } else {
      // Unknown error
      throw new AppError({
        code: 'unknown/error',
        message: 'Something went wrong',
        hint: error.message
      });
    }
  }
}

// ============================================
// Example 7: Concurrency Control
// ============================================

import { batchWithConcurrency } from './netlify/lib/rate-limiter';

async function processMultipleResumes(files: File[]) {
  const results = await batchWithConcurrency(
    files,
    async (file) => {
      // Process each file
      return await parseResume(file);
    },
    {
      concurrency: 3, // Process 3 files at once
      rateLimiter: deepseekLimiter, // Apply rate limiting
      onProgress: (completed, total) => {
        console.log(`Processed ${completed}/${total} resumes`);
        // Update progress bar: (completed / total) * 100
      }
    }
  );
  
  // Results is PromiseSettledResult[]
  const successful = results.filter(r => r.status === 'fulfilled');
  const failed = results.filter(r => r.status === 'rejected');
  
  console.log(`✅ ${successful.length} succeeded`);
  console.log(`❌ ${failed.length} failed`);
  
  return {
    successful: successful.map(r => r.value),
    failed: failed.map((r, i) => ({
      file: files[i].name,
      error: r.reason?.message || 'Unknown error'
    }))
  };
}

// ============================================
// Example 8: Testing Utilities
// ============================================

// Mock OCR response for testing
export function mockOcrResponse() {
  return {
    text: 'John Doe\njohn@example.com\nSoftware Engineer...',
    structured: {
      name: 'John Doe',
      email: 'john@example.com',
      phone: '+1-234-567-8900',
      experience: [
        {
          title: 'Senior Developer',
          company: 'Tech Corp',
          duration: '2020-2023',
          responsibilities: [
            'Led team of 5 engineers',
            'Reduced API latency by 40%'
          ]
        }
      ],
      education: [
        {
          degree: 'BS Computer Science',
          institution: 'MIT',
          year: '2020'
        }
      ],
      skills: ['JavaScript', 'React', 'Node.js', 'TypeScript'],
      certifications: ['AWS Certified Developer']
    },
    usedOCR: true
  };
}

// Test batch processing locally
export async function testBatchApi() {
  const mockResume = 'John Doe\nSoftware Engineer\n...';
  const mockJob = 'Looking for Senior Developer...';
  
  const result = await batchProcess([
    {
      id: 'test-parse',
      type: 'parse',
      payload: { kind: 'text', value: mockResume }
    },
    {
      id: 'test-match',
      type: 'match',
      payload: { resumeText: mockResume, jobDesc: mockJob }
    }
  ]);
  
  console.log('Batch test results:', result);
  return result;
}

// ============================================
// Example 9: Environment Detection
// ============================================

// Check if DeepSeek OCR is available
export function isOcrAvailable() {
  // Backend check
  if (typeof process !== 'undefined') {
    return !!process.env.DEEPSEEK_API_KEY;
  }
  
  // Frontend can't check directly, but can test with a ping endpoint
  return fetch('/.netlify/functions/parse-resume', {
    method: 'OPTIONS'
  })
    .then(r => r.ok)
    .catch(() => false);
}

// Check rate limiter health
export async function checkRateLimiterHealth() {
  const stats = deepseekLimiter.getStats();
  
  return {
    healthy: stats.queuedRequests < 10,
    activeRequests: stats.activeRequests,
    queuedRequests: stats.queuedRequests,
    requestsLastMinute: stats.requestsInLastMinute,
    status: stats.queuedRequests > 10 
      ? 'degraded' 
      : stats.activeRequests > 0 
      ? 'busy' 
      : 'idle'
  };
}

export {
  uploadScannedResume,
  processResumeWithJob,
  customBatchRequest,
  ResumeUploadComponent,
  robustResumeProcessing,
  processMultipleResumes,
  testBatchApi
};
