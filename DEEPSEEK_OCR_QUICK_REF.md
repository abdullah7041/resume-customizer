# OCR & Batch API - Quick Reference

> **⚠️ UPDATED:** OCR now uses **OpenAI Vision API (GPT-4o-mini)** instead of DeepSeek for better reliability and accuracy.

## 🚀 Quick Start

### 1. Set Environment Variable
```bash
OPENAI_API_KEY=sk-your-openai-key-here
```

### 2. Upload Image Resume
```javascript
// Automatically uses OCR for images
const file = document.querySelector('input[type=file]').files[0];
const result = await parseResume(file);
console.log('Used OCR:', result.usedOCR);
```

### 3. Batch Process
```javascript
import { processResumeBatch } from './services/api.js';

const result = await processResumeBatch({
  resumeInput: file,
  jobDescription: jobText,
  onProgress: (completed, total) => console.log(`${completed}/${total}`)
});
```

---

## 📋 API Endpoints

### Parse Resume (Enhanced)
`POST /.netlify/functions/parse-resume`

**Auto-detects:**
- Images → OpenAI Vision OCR
- Low-quality PDFs → OCR fallback
- Normal PDFs/DOCX → Standard extraction

**Response includes:**
- `usedOCR: boolean` - Whether OCR was used
- `structured: object` - Structured resume data (if OCR)
- `document: object` - Normalized resume document

### Batch API (New)
`POST /.netlify/functions/batch-api`

**Task Types:**
- `parse` - Parse resume
- `match` - Analyze match score
- `optimize` - Generate suggestions
- `predict-questions` - Interview questions
- `generate-cover-letter` - Cover letter

**Request:**
```json
{
  "tasks": [
    { "id": "1", "type": "parse", "payload": {...} },
    { "id": "2", "type": "match", "payload": {...} }
  ],
  "options": {
    "concurrency": 3,
    "continueOnError": true
  }
}
```

---

## 🔧 Rate Limiting

### Default Settings
```typescript
{
  maxConcurrent: 3,              // 3 simultaneous requests
  minDelayBetweenRequestsMs: 500, // 500ms between requests
  maxRequestsPerMinute: 20        // 20 req/min max
}
```

### Retry Settings
```typescript
{
  maxRetries: 3,
  initialDelayMs: 1000,    // 1s → 2s → 4s → 8s
  retryableStatusCodes: [429, 500, 502, 503]
}
```

### Usage
```typescript
import { RateLimiter, withRetry } from '../lib/rate-limiter';

const limiter = new RateLimiter();
await limiter.execute(() => callAPI());

await withRetry(() => callAPI(), { maxRetries: 3 });
```

---

## 🎨 UI Components

### OcrBadge
```jsx
import OcrBadge from './components/ui/OcrBadge';

{usedOCR && <OcrBadge />}
```

Shows: `[✨ OCR Extracted]` badge with purple gradient

---

## 🧪 Testing

### Local Testing
```bash
npm run dev:netlify
# Server runs on http://localhost:8888
```

### Test OCR Endpoint
```bash
curl -X POST http://localhost:8888/.netlify/functions/parse-resume \
  -H "Content-Type: application/json" \
  -d '{"kind":"file","name":"resume.jpg","mime":"image/jpeg","data":"..."}'
```

### Test Batch Endpoint
```bash
curl -X POST http://localhost:8888/.netlify/functions/batch-api \
  -H "Content-Type: application/json" \
  -d '{"tasks":[{"id":"1","type":"parse","payload":{...}}]}'
```

---

## 🐛 Common Issues

### OCR Not Working
- ✅ Check `OPENAI_API_KEY` is set
- ✅ Verify file is image or low-quality PDF
- ✅ Check file size < 8 MB
- ✅ Test API key: `curl https://api.openai.com/v1/models -H "Authorization: Bearer $OPENAI_API_KEY"`

### Batch Timeouts
- ✅ Reduce batch size (max 5 tasks)
- ✅ Lower concurrency to 2
- ✅ Check individual endpoint timeouts

### Rate Limit Errors
- ✅ Monitor with `rateLimiter.getStats()`
- ✅ Increase `minDelayBetweenRequestsMs`
- ✅ Reduce `maxRequestsPerMinute`

---

## 📊 File Locations

```
netlify/functions/
  ├── parse-resume.ts          # Enhanced with OCR
  ├── batch-api.ts             # NEW - Batch endpoint
  └── lib/
      └── rate-limiter.ts      # NEW - Rate limiting utils

src/
  ├── services/
  │   └── api.js              # Added batchProcess()
  ├── features/
  │   └── ResumeUpload.jsx    # Added OCR badge
  └── components/ui/
      └── OcrBadge.jsx        # NEW - OCR indicator
```

---

## 💡 Best Practices

### 1. Batch Small Tasks Together
```javascript
// ✅ Good
const tasks = [parse, match, optimize]; // 3 tasks

// ❌ Avoid
const tasks = Array(20).fill(parse); // Too many
```

### 2. Use Appropriate Concurrency
```javascript
// Complex operations (optimize, cover letter)
concurrency: 2

// Simple operations (parse, match)
concurrency: 3-4
```

### 3. Handle Errors Gracefully
```javascript
const result = await batchProcess(tasks, {
  continueOnError: true  // Don't stop on first error
});

result.results.forEach(r => {
  if (r.status === 'error') {
    console.error(`Task ${r.id} failed:`, r.error);
  }
});
```

### 4. Monitor Progress
```javascript
await processResumeBatch({
  resumeInput: file,
  jobDescription: job,
  onProgress: (completed, total) => {
    setProgressPercent((completed / total) * 100);
  }
});
```

---

## 🔐 Security Checklist

- [ ] API keys in environment variables only
- [ ] Never commit keys to git
- [ ] Validate all file uploads (size, type)
- [ ] Sanitize user text inputs
- [ ] Limit batch size (max 10 tasks)
- [ ] Implement rate limiting
- [ ] Log errors server-side only

---

## 📈 Performance Metrics

**OCR Processing:**
- Image extraction: 2-5 seconds
- Structured JSON: 3-8 seconds
- Fallback to standard: <1 second

**Batch Processing:**
- 3 tasks @ concurrency=3: 3-5 seconds
- 5 tasks @ concurrency=2: 8-12 seconds
- Single task overhead: +300ms

**Rate Limits:**
- OpenAI gpt-4o-mini: Varies by tier (check dashboard)
- Typical: 500 req/min for paid tier
- Free tier: 3 req/min

---

## 🎯 Next Steps

1. **Try OCR**: Upload a scanned resume or screenshot
2. **Test Batch**: Process parse+match+optimize together
3. **Monitor**: Check Netlify function logs
4. **Optimize**: Adjust rate limits based on usage

For detailed testing instructions, see `OCR_TESTING_GUIDE.md`
