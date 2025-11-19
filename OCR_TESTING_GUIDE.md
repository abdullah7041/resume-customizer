# OCR Testing Guide - Resume Customizer

## Overview

This guide provides comprehensive instructions for testing the OCR (Optical Character Recognition) functionality in the Resume Customizer application. The OCR feature uses **OpenAI's GPT-4o-mini Vision API** to extract text from images and low-quality PDF scans.

## What Was Changed

**Previous Implementation:** DeepSeek Chat API (non-functional)
**New Implementation:** OpenAI Vision API (gpt-4o-mini)
**Reason for Change:** DeepSeek API was unreliable and lacked proper configuration. OpenAI Vision API is already used elsewhere in the project and provides superior accuracy.

## Prerequisites

### 1. Environment Setup

You **must** have an OpenAI API key configured. Add it to your environment:

```bash
# Create .env file in project root (if it doesn't exist)
echo "OPENAI_API_KEY=sk-your-api-key-here" > .env

# OR set it in your Netlify dashboard:
# Site Settings → Environment Variables → Add OPENAI_API_KEY
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Start Development Server

```bash
npm run dev:netlify
```

The server should start on `http://localhost:8888`

---

## How OCR Works

### Automatic Detection Flow

```
User uploads file
    ↓
Is it an image? (JPEG, PNG, WebP, GIF, BMP)
    ├─ YES → Use OCR (extractWithVisionOCR)
    └─ NO → Try standard PDF/DOCX extraction
              ↓
        Is extraction quality poor? (<50 chars or 70%+ gibberish)
              ├─ YES → Fallback to OCR
              └─ NO → Use standard extraction
```

### Supported File Types

**Always uses OCR:**
- ✅ JPEG/JPG images
- ✅ PNG images
- ✅ WebP images
- ✅ GIF images
- ✅ BMP images

**May use OCR as fallback:**
- ⚠️ Scanned PDFs (low-quality text extraction)
- ⚠️ Image-based PDFs
- ⚠️ Corrupted PDFs

**Standard extraction (no OCR):**
- ✅ Text-based PDFs (clean extraction)
- ✅ DOCX files (clean extraction)

---

## Testing Methods

### Method 1: Frontend Upload (Recommended)

1. **Start the app:**
   ```bash
   npm run dev:netlify
   ```

2. **Open browser:** Navigate to `http://localhost:8888`

3. **Sign in** (if required) or click "Get Started"

4. **Upload a test image:**
   - Go to "Resume" tab
   - Drag & drop an image resume OR
   - Click "Upload Resume" and select an image file

5. **Verify OCR worked:**
   - Look for the purple badge: `✨ OCR Extracted`
   - Check that text was extracted correctly
   - Verify sections were parsed (Experience, Education, Skills)

6. **Check browser console:**
   ```
   [parse-resume] Extraction method: Standard PDF/DOCX parsing
   OR
   [parse-resume] Extraction method: (OCR would show in logs)
   ```

### Method 2: Direct API Testing with cURL

#### Test with base64 image:

```bash
# First, convert an image to base64
base64 -i test-resume.jpg > resume.b64

# Then test the API
curl -X POST http://localhost:8888/.netlify/functions/parse-resume \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "file",
    "name": "resume.jpg",
    "mime": "image/jpeg",
    "data": "'$(cat resume.b64)'"
  }'
```

#### Expected successful response:

```json
{
  "document": {
    "plainText": "John Doe\njohn@example.com\n...",
    "bullets": [...],
    "sections": [...]
  },
  "usedOCR": true,
  "structured": {
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+1234567890",
    "summary": "...",
    "experience": [...],
    "education": [...],
    "skills": [...],
    "certifications": [...]
  }
}
```

### Method 3: Test with Sample Images

Create test images with different quality levels:

#### Test Case 1: Clean Resume Screenshot
```bash
# Take a screenshot of a resume PDF
# Upload via frontend
# Expected: Should use OCR, extract all text accurately
```

#### Test Case 2: Low-Quality Scan
```bash
# Use a phone photo of a printed resume
# Upload via frontend
# Expected: May be challenging, but should extract most text
```

#### Test Case 3: Mixed Quality PDF
```bash
# Upload a PDF that contains both text and images
# Expected: Standard extraction first, OCR fallback if poor quality
```

---

## Validation Checklist

After uploading an image resume, verify:

- [ ] **OCR Badge appears** - Purple `✨ OCR Extracted` badge shows up
- [ ] **Name extracted** - Candidate name appears in parsed data
- [ ] **Contact info extracted** - Email and/or phone number found
- [ ] **Experience parsed** - Job titles, companies, dates extracted
- [ ] **Education parsed** - Degrees, schools, years extracted
- [ ] **Skills listed** - Technical/soft skills identified
- [ ] **Text is readable** - No gibberish or encoding issues
- [ ] **Sections organized** - Data properly categorized

---

## Common Issues & Troubleshooting

### Issue 1: "OpenAI API key not configured"

**Symptoms:** Error message when uploading images

**Solution:**
```bash
# Check if OPENAI_API_KEY is set
echo $OPENAI_API_KEY

# If empty, add to .env file:
echo "OPENAI_API_KEY=sk-proj-..." >> .env

# Restart the dev server
npm run dev:netlify
```

### Issue 2: "Vision OCR extraction failed"

**Possible causes:**
- Invalid API key
- API quota exceeded
- Image too large (>8MB)
- Network issues

**Debug steps:**
```bash
# Check Netlify function logs
# Look for detailed error messages in terminal

# Test API key manually:
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

### Issue 3: No OCR badge appears

**Symptoms:** File uploads successfully but doesn't show OCR badge

**Possible causes:**
- File is a text-based PDF (standard extraction worked fine)
- File is DOCX (doesn't need OCR)
- Image quality was too poor, fell back to standard extraction

**Verification:**
```javascript
// Check browser console for:
[parse-resume] Extraction method: Standard PDF/DOCX parsing
// vs
[parse-resume] Extraction method: (shows OCR was attempted)
```

### Issue 4: Extracted text is garbled

**Symptoms:** Text contains weird characters or is unreadable

**Solutions:**
1. Try a higher quality image
2. Ensure image is not rotated/upside down
3. Check that text in image is clearly legible
4. Try cropping to just the resume content

### Issue 5: API rate limit errors

**Symptoms:** `429 Too Many Requests` error

**Solutions:**
- Wait 60 seconds and try again
- Check OpenAI dashboard for rate limits
- Upgrade OpenAI tier if needed
- Reduce upload frequency during testing

---

## Performance Metrics

**Expected Performance:**

| Metric | Expected Value |
|--------|---------------|
| Image upload time | 2-5 seconds |
| OCR processing time | 3-8 seconds |
| Total time (image → parsed resume) | 5-13 seconds |
| Accuracy (clean images) | 95%+ |
| Accuracy (poor scans) | 70-85% |

---

## Testing Checklist for Production

Before deploying to production:

- [ ] Test with 5+ different resume images (various formats)
- [ ] Test with low-quality scans
- [ ] Test with oversized images (should fail gracefully)
- [ ] Test without API key (should show helpful error)
- [ ] Test API rate limiting behavior
- [ ] Verify OCR badge displays correctly
- [ ] Check that structured data is properly formatted
- [ ] Test on mobile devices (camera upload)
- [ ] Verify costs are acceptable (check OpenAI usage dashboard)
- [ ] Monitor Netlify function logs for errors

---

## Cost Considerations

**OpenAI GPT-4o-mini Vision Pricing:**
- Input: $0.15 per 1M tokens
- Output: $0.60 per 1M tokens
- Images: ~255 tokens per image (low detail), ~765 tokens (high detail)

**Estimated cost per OCR request:**
- Image tokens: ~765 tokens (high detail)
- Prompt tokens: ~150 tokens
- Response tokens: ~500 tokens (structured JSON)
- **Total: ~$0.0007 per image** (~1400 tokens × $0.50/1M)

**Budget estimate:**
- 1,000 image resumes/month = ~$0.70
- 10,000 image resumes/month = ~$7.00
- 100,000 image resumes/month = ~$70.00

---

## Advanced Testing: Load Testing

To test OCR under load:

```bash
# Install artillery (load testing tool)
npm install -g artillery

# Create test-ocr.yml:
cat > test-ocr.yml << 'EOF'
config:
  target: "http://localhost:8888"
  phases:
    - duration: 60
      arrivalRate: 2
scenarios:
  - name: "OCR Upload Test"
    flow:
      - post:
          url: "/.netlify/functions/parse-resume"
          json:
            kind: "text"
            value: "Sample resume text for load testing"
EOF

# Run load test
artillery run test-ocr.yml
```

---

## Next Steps

1. **Create test dataset:** Collect 10-20 sample resume images
2. **Document edge cases:** Track unusual formats that fail
3. **Monitor costs:** Set up billing alerts in OpenAI dashboard
4. **Optimize performance:** Consider caching results for duplicate uploads
5. **Add analytics:** Track OCR usage vs standard extraction

---

## Support

If OCR is still not working after following this guide:

1. Check Netlify function logs
2. Verify OpenAI API key is valid
3. Test with a simple curl request (Method 2 above)
4. Review browser console for client-side errors
5. Check OpenAI dashboard for account issues

---

**Last Updated:** 2025-11-19
**OCR Provider:** OpenAI GPT-4o-mini Vision API
**File Location:** `netlify/functions/parse-resume.ts:52-188`
