# DeepSeek OCR & Batch API Implementation Guide

## Overview

This document describes the new DeepSeek OCR integration and Batch API capabilities added to the Resume Optimizer application.

## 🚀 New Features

### 1. DeepSeek OCR Integration

Automatically extracts text from:
- Scanned PDF documents
- Image files (JPEG, PNG, WebP, GIF, BMP)
- Low-quality PDFs with poor text extraction

**Benefits:**
- Handles resumes that traditional PDF parsers can't read
- Returns structured JSON with fields like name, email, experience, education
- Falls back gracefully when OCR isn't needed
- Visual indicator shows when OCR was used

### 2. Batch API Processing

Process multiple operations in a single API call:
- Parse resume + analyze match + optimize = 1 request
- Automatic concurrency control and rate limiting
- Error handling with `continueOnError` option
- Progress tracking for long-running batches

**Benefits:**
- Reduces latency (3 separate calls → 1 batch call)
- Better resource utilization
- Built-in retry logic and rate limiting
- Detailed error reporting per task

---

## 📁 File Structure

### Backend (`netlify/functions/`)

```
netlify/functions/
├── parse-resume.ts          # Enhanced with DeepSeek OCR
├── batch-api.ts             # NEW - Batch processing endpoint
└── lib/
    └── rate-limiter.ts      # NEW - Rate limiting utilities
```

### Frontend (`src/`)

```
src/
├── services/
│   └── api.js              # Added batchProcess() and processResumeBatch()
├── features/
│   └── ResumeUpload.jsx    # Added OCR indicator
└── components/ui/
    └── OcrBadge.jsx        # NEW - Visual OCR indicator
```

---

## 🔧 Setup Instructions

### 1. Environment Variables

Add to your `.env` or Netlify environment variables:

```bash
# Required for OCR functionality
DEEPSEEK_API_KEY=your_deepseek_api_key_here

# Existing variables (keep these)
OPENAI_API_KEY=your_openai_key
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_key
```

**Get DeepSeek API Key:**
1. Visit [https://platform.deepseek.com](https://platform.deepseek.com)
2. Sign up and navigate to API Keys
3. Create a new key with vision/OCR permissions

### 2. Install Dependencies

All required dependencies are already in `package.json`:
- `axios` (for HTTP requests)
- `@netlify/functions` (serverless functions)

### 3. Deploy

```bash
# Local testing
npm run dev:netlify

# Production deployment
git push origin main
# Netlify auto-deploys from main branch
```

---

## 📖 API Documentation

### DeepSeek OCR Endpoint

**Enhanced:** `POST /.netlify/functions/parse-resume`

**Request:**
```json
{
  "kind": "file",
  "name": "resume.jpg",
  "mime": "image/jpeg",
  "data": "base64_encoded_image_data"
}
```

**Response:**
```json
{
  "document": {
    "plainText": "Extracted resume text...",
    "bullets": ["bullet 1", "bullet 2"],
    "sections": [...]
  },
  "usedOCR": true,
  "structured": {
    "name": "John Doe",
    "email": "john@example.com",
    "experience": [...],
    "education": [...],
    "skills": [...]
  }
}
```

**Flow:**
1. Check file type (image vs PDF/DOCX)
2. For images → use DeepSeek OCR immediately
3. For PDFs → try standard extraction first
4. If extraction quality is low → fallback to OCR
5. Return structured data + plain text + OCR flag

### Batch API Endpoint

**New:** `POST /.netlify/functions/batch-api`

**Request:**
```json
{
  "tasks": [
    {
      "id": "parse-1",
      "type": "parse",
      "payload": {
        "kind": "file",
        "data": "...",
        "name": "resume.pdf"
      }
    },
    {
      "id": "match-1",
      "type": "match",
      "payload": {
        "resumeText": "...",
        "jobDesc": "..."
      }
    },
    {
      "id": "optimize-1",
      "type": "optimize",
      "payload": {
        "resumeText": "...",
        "jobDesc": "...",
        "mode": "auto"
      }
    }
  ],
  "options": {
    "concurrency": 3,
    "continueOnError": true
  }
}
```

**Response:**
```json
{
  "results": [
    {
      "id": "parse-1",
      "type": "parse",
      "status": "success",
      "data": { ... }
    },
    {
      "id": "match-1",
      "type": "match",
      "status": "success",
      "data": { ... }
    },
    {
      "id": "optimize-1",
      "type": "optimize",
      "status": "error",
      "error": "Request timed out"
    }
  ],
  "summary": {
    "total": 3,
    "successful": 2,
    "failed": 1
  }
}
```

**Supported Task Types:**
- `parse` - Parse resume file or text
- `match` - Analyze resume-job match score
- `optimize` - Generate optimization suggestions
- `predict-questions` - Predict interview questions
- `generate-cover-letter` - Generate cover letter

---

## 💻 Usage Examples

### Frontend: Using Batch API

```javascript
import { processResumeBatch } from '../services/api.js';

// Process resume with job description in one call
const handleBatchProcess = async () => {
  const result = await processResumeBatch({
    resumeInput: file, // or text string
    jobDescription: jobText,
    mode: 'auto',
    onProgress: (completed, total) => {
      console.log(`${completed}/${total} tasks completed`);
    }
  });

  if (result.parsed) {
    console.log('Resume parsed:', result.parsed.document);
    console.log('Used OCR:', result.usedOCR);
  }

  if (result.match) {
    console.log('Match score:', result.match.score);
  }

  if (result.optimized) {
    console.log('Optimization cards:', result.optimized.cards);
  }

  if (result.errors.length > 0) {
    console.error('Some tasks failed:', result.errors);
  }
};
```

### Frontend: Manual Batch Request

```javascript
import { batchProcess } from '../services/api.js';

const tasks = [
  {
    id: 'task-1',
    type: 'parse',
    payload: { kind: 'text', value: resumeText }
  },
  {
    id: 'task-2',
    type: 'match',
    payload: { resumeText, jobDesc }
  }
];

const result = await batchProcess(tasks, {
  concurrency: 2,
  continueOnError: true
});

console.log('Batch results:', result.results);
console.log('Summary:', result.summary);
```

### Backend: Testing DeepSeek OCR

```bash
# Using curl to test OCR endpoint
curl -X POST http://localhost:8888/.netlify/functions/parse-resume \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "file",
    "name": "resume.jpg",
    "mime": "image/jpeg",
    "data": "'$(base64 -w 0 resume.jpg)'"
  }'
```

---

## ⚙️ Rate Limiting & Retry Logic

### Built-in Rate Limiting

The `RateLimiter` class handles API throttling:

```typescript
const limiter = new RateLimiter({
  maxConcurrent: 3,           // Max 3 simultaneous requests
  minDelayBetweenRequestsMs: 500,  // 500ms between requests
  maxRequestsPerMinute: 20    // Max 20 requests per minute
});

// Use with any async function
await limiter.execute(async () => {
  return await callDeepSeekAPI();
});
```

### Exponential Backoff Retry

The `withRetry` function handles transient failures:

```typescript
import { withRetry } from '../lib/rate-limiter';

const result = await withRetry(
  async () => fetch('https://api.deepseek.com/...'),
  {
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
    retryableStatusCodes: new Set([429, 500, 502, 503])
  }
);
```

**Retry Behavior:**
- Attempt 1 fails → wait 1s + jitter
- Attempt 2 fails → wait 2s + jitter
- Attempt 3 fails → wait 4s + jitter
- Attempt 4 fails → throw error

**Retryable Conditions:**
- HTTP 429 (rate limit)
- HTTP 500/502/503/504 (server errors)
- Network errors (ECONNREFUSED, ENOTFOUND)

**Non-Retryable:**
- Timeouts (AbortError)
- HTTP 400/401/403 (client errors)
- HTTP 404 (not found)

### Batch Concurrency Control

```typescript
import { batchWithConcurrency } from '../lib/rate-limiter';

const items = [file1, file2, file3, file4, file5];

const results = await batchWithConcurrency(
  items,
  async (file) => await processFile(file),
  {
    concurrency: 2,  // Process 2 at a time
    rateLimiter: limiter,  // Apply rate limiting
    onProgress: (completed, total) => {
      console.log(`${completed}/${total} completed`);
    }
  }
);

// results is PromiseSettledResult<T>[]
results.forEach((result, i) => {
  if (result.status === 'fulfilled') {
    console.log(`Item ${i} succeeded:`, result.value);
  } else {
    console.log(`Item ${i} failed:`, result.reason);
  }
});
```

---

## 🎨 UI Components

### OcrBadge Component

Displays when OCR was used:

```jsx
import OcrBadge from './components/ui/OcrBadge';

<OcrBadge className="mt-4" />
// Renders: [✨ OCR Extracted] badge with purple gradient
```

**Styling:**
- Purple gradient background with blur
- Sparkles icon (Lucide React)
- Tooltip on hover: "Text extracted using AI OCR technology"

---

## 🐛 Error Handling

### Common Errors

**1. DeepSeek API Key Missing**
```
Error: DeepSeek API key not configured
Fix: Set DEEPSEEK_API_KEY in environment variables
```

**2. OCR Extraction Failed**
```
Error: DeepSeek OCR extraction failed: Rate limit exceeded
Fix: Retry after delay - automatic with withRetry()
```

**3. Batch Validation Error**
```
Error: Task at index 2 has invalid type 'analyze'
Fix: Use valid task types: parse, match, optimize, etc.
```

**4. Low Quality Extraction**
```
Behavior: Automatically falls back to OCR
Log: "[parse-resume] Low quality extraction detected, attempting OCR fallback"
```

### Debugging

Enable verbose logging:

```javascript
// In api.js
const DEBUG = true;

if (DEBUG) {
  console.log('[batch-api] Request:', tasks);
  console.log('[batch-api] Response:', result);
}
```

Check rate limiter stats:

```javascript
const stats = rateLimiter.getStats();
console.log('Active:', stats.activeRequests);
console.log('Queued:', stats.queuedRequests);
console.log('Last minute:', stats.requestsInLastMinute);
```

---

## 🧪 Testing

### Unit Tests

```bash
npm test -- rate-limiter.test.ts
npm test -- batch-api.test.ts
npm test -- parse-resume.test.ts
```

### Integration Tests

```bash
# Start local dev server
npm run dev:netlify

# Test batch endpoint
curl -X POST http://localhost:8888/.netlify/functions/batch-api \
  -H "Content-Type: application/json" \
  -d @test-batch-request.json

# Test OCR endpoint
npm run test:ocr
```

### Manual Testing Checklist

- [ ] Upload PDF with selectable text → no OCR used
- [ ] Upload scanned PDF → OCR used + badge shown
- [ ] Upload JPEG resume → OCR used + badge shown
- [ ] Batch process: parse + match + optimize → all succeed
- [ ] Batch with one failing task → continueOnError works
- [ ] Rate limit: 20+ requests in 1 min → queued properly
- [ ] Network error → retry with backoff

---

## 🚀 Performance Tips

### 1. Optimize Batch Size
```javascript
// Good: 3-5 tasks per batch
const tasks = [parse, match, optimize];

// Bad: 20+ tasks in one batch
// (increases timeout risk)
```

### 2. Adjust Concurrency
```javascript
// For complex operations (optimize)
concurrency: 2

// For simple operations (parse)
concurrency: 4
```

### 3. Use Appropriate Timeouts
```javascript
// parse-resume: 15s
// match-score: 15s
// optimize: 25s
// batch-api: 60s
```

### 4. Monitor Rate Limits

DeepSeek limits:
- Free tier: ~10 req/min
- Paid tier: Check your plan

OpenAI limits:
- gpt-5-nano: Check tier limits

---

## 📊 Monitoring

### Netlify Function Logs

```bash
netlify logs:function parse-resume
netlify logs:function batch-api
```

### Key Metrics to Track

- OCR usage rate (% of resumes using OCR)
- Batch API success rate
- Average batch processing time
- Rate limit hits per day
- Retry attempts per request

### Example Logging

```typescript
// In parse-resume.ts
console.log('[parse-resume] Processing:', {
  fileName: body.name,
  mimeType,
  isImage: IMAGE_MIME_TYPES.has(mimeType),
  size: arrayBuffer.byteLength
});

if (usedOCR) {
  console.log('[parse-resume] OCR extraction succeeded');
} else {
  console.log('[parse-resume] Standard extraction used');
}
```

---

## 🔐 Security Considerations

1. **API Key Security**
   - Store keys in Netlify environment variables
   - Never commit keys to git
   - Rotate keys periodically

2. **Input Validation**
   - Max file size: 8 MB
   - Max batch tasks: 10
   - Sanitize all text inputs

3. **Rate Limiting**
   - Protects against abuse
   - Prevents API quota exhaustion
   - Implements exponential backoff

4. **Error Messages**
   - Don't expose internal errors to frontend
   - Sanitize error messages
   - Log detailed errors server-side only

---

## 🆘 Troubleshooting

### Issue: OCR Not Triggering

**Symptoms:** Images uploaded but standard extraction used

**Solutions:**
1. Check `DEEPSEEK_API_KEY` is set
2. Verify mime type detection: `inferMimeType({ mime, fileName })`
3. Check file size < 8 MB
4. Review logs for OCR errors

### Issue: Batch API Timeouts

**Symptoms:** 504 errors on batch requests

**Solutions:**
1. Reduce batch size (max 5 tasks)
2. Increase `BATCH_TIMEOUT` in api.js
3. Use lower concurrency (2 instead of 3)
4. Check individual endpoint timeouts

### Issue: Rate Limit Errors

**Symptoms:** "Too many requests" errors

**Solutions:**
1. Check `maxRequestsPerMinute` setting
2. Increase `minDelayBetweenRequestsMs`
3. Monitor `rateLimiter.getStats()`
4. Upgrade API plan if needed

---

## 📚 Additional Resources

- [DeepSeek API Docs](https://platform.deepseek.com/docs)
- [Netlify Functions Guide](https://docs.netlify.com/functions/overview/)
- [Promise.allSettled MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/allSettled)
- [Exponential Backoff Algorithm](https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/)

---

## 📝 Summary

**New Capabilities:**
✅ DeepSeek OCR for scanned resumes and images  
✅ Batch API for combining multiple operations  
✅ Rate limiting and retry logic  
✅ Visual OCR indicator in UI  
✅ Structured JSON extraction from images  

**Key Benefits:**
- Handles previously unsupported resume formats
- Reduces API latency with batching
- Improves reliability with retries
- Better user experience with progress tracking

**Next Steps:**
1. Set `DEEPSEEK_API_KEY` environment variable
2. Test OCR with scanned resume
3. Try batch API for combined operations
4. Monitor logs and adjust rate limits as needed
