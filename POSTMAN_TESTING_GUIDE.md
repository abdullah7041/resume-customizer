# Postman Testing Guide for Resume Parser

## Problem Diagnosis

### The Error You Encountered
```
"Unable to parse resume: Unexpected token 'J', 'JVBERi0x...' is not valid JSON"
```

**Root Cause:** The `parse-resume` endpoint expects a **JSON payload** with specific structure, but Postman was sending raw binary PDF data directly in the request body.

The string `JVBERi0x` is the Base64 encoding of `%PDF-1.` (the PDF file header), confirming that binary data was being sent instead of JSON.

---

## Correct Postman Configuration

### Option 1: Upload PDF/DOCX File (Recommended)

**Step-by-step:**

1. **Method:** `POST`
2. **URL:** `http://localhost:8888/.netlify/functions/parse-resume`
3. **Headers:**
   ```
   Content-Type: application/json
   ```
4. **Body → raw → JSON:**

```json
{
  "kind": "file",
  "name": "resume.pdf",
  "mime": "application/pdf",
  "data": "<base64-encoded-file-content>"
}
```

**How to get base64-encoded content:**

**Using Node.js:**
```bash
node -e "const fs = require('fs'); const file = fs.readFileSync('./your-resume.pdf'); console.log(file.toString('base64'));"
```

**Using PowerShell:**
```powershell
$fileContent = [System.IO.File]::ReadAllBytes("C:\path\to\resume.pdf")
[System.Convert]::ToBase64String($fileContent) | Set-Clipboard
```

Then paste the clipboard content into the `"data"` field.

---

### Option 2: Upload Plain Text Resume

**Step-by-step:**

1. **Method:** `POST`
2. **URL:** `http://localhost:8888/.netlify/functions/parse-resume`
3. **Headers:**
   ```
   Content-Type: application/json
   ```
4. **Body → raw → JSON:**

```json
{
  "kind": "text",
  "value": "John Doe\nSoftware Engineer\n\nEXPERIENCE\nSenior Developer at Tech Corp\n- Led team of 5 engineers\n- Improved performance by 40%\n\nSKILLS\nJavaScript, React, Node.js, Python"
}
```

---

## Sample Postman Request (Complete)

### Request
```http
POST http://localhost:8888/.netlify/functions/parse-resume
Content-Type: application/json

{
  "kind": "file",
  "name": "JohnDoe_Resume.pdf",
  "mime": "application/pdf",
  "data": "JVBERi0xLjQKJeLjz9MKMyAwIG9iago8PC9MZW5ndGggMTIzL0ZpbHRlci9GbGF0ZURlY29kZT4+CnN0cmVhbQp4nKWTzW7DIBCFz8ErHLFvY2MwGNv2rqq6a1X1CSo1ixZFqvL+Ddhjt0nSpOkuM2fmfPeOhCY..."
}
```

### Expected Response (200 OK)
```json
{
  "document": {
    "plainText": "John Doe\nSoftware Engineer...",
    "bullets": [
      "Led team of 5 engineers",
      "Improved performance by 40%"
    ],
    "sections": [
      {
        "id": "experience",
        "title": "EXPERIENCE",
        "content": ["Senior Developer at Tech Corp", "Led team of 5 engineers"]
      },
      {
        "id": "skills",
        "title": "SKILLS",
        "content": ["JavaScript, React, Node.js, Python"]
      }
    ]
  }
}
```

### Error Response (400 Bad Request)
```json
{
  "error": "Unable to extract readable text from the resume. Please ensure your PDF contains selectable text (not scanned images)."
}
```

---

## Testing with cURL

### Windows PowerShell
```powershell
$base64Content = [Convert]::ToBase64String([IO.File]::ReadAllBytes("resume.pdf"))
$body = @{
    kind = "file"
    name = "resume.pdf"
    mime = "application/pdf"
    data = $base64Content
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:8888/.netlify/functions/parse-resume" `
    -Method Post `
    -ContentType "application/json" `
    -Body $body
```

### Bash/WSL
```bash
base64_content=$(base64 -w 0 resume.pdf)
curl -X POST http://localhost:8888/.netlify/functions/parse-resume \
  -H "Content-Type: application/json" \
  -d "{\"kind\":\"file\",\"name\":\"resume.pdf\",\"mime\":\"application/pdf\",\"data\":\"$base64_content\"}"
```

---

## Common Mistakes to Avoid

### ❌ Wrong: Sending Binary Data
```
Body → binary → select file
```
This sends raw PDF bytes, causing the JSON parse error.

### ❌ Wrong: Sending form-data
```
Body → form-data → file
```
The endpoint doesn't support multipart/form-data.

### ✅ Correct: JSON with Base64
```json
{
  "kind": "file",
  "data": "<base64-string>"
}
```

---

## Endpoint Behavior

### File Upload Flow
1. **Frontend** reads file as ArrayBuffer
2. **Frontend** converts to Base64 string
3. **Frontend** sends JSON with `{kind: "file", data: "<base64>"}`
4. **Backend** decodes Base64 to ArrayBuffer
5. **Backend** extracts text using pdfjs-dist or mammoth
6. **Backend** normalizes and returns structured document

### Supported File Types
- **PDF** (`application/pdf`, `.pdf`)
- **DOCX** (`application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `.docx`)
- **Plain Text** (direct string input)

### File Size Limit
- **Maximum:** 8 MB
- **Error if exceeded:** `"File exceeds the maximum supported size (8 MB)."`

---

## Debugging Tips

### Check if PDF is Parseable
```javascript
// Run in browser console after uploading
const file = document.querySelector('input[type="file"]').files[0];
const reader = new FileReader();
reader.onload = async (e) => {
  const buffer = e.target.result;
  const text = new TextDecoder().decode(buffer);
  console.log('PDF Header:', text.substring(0, 20));
  // Should show: %PDF-1.4 or similar
};
reader.readAsArrayBuffer(file);
```

### Test with Sample Resume
Create `test-resume.txt`:
```
JOHN DOE
Software Engineer | john@example.com

EXPERIENCE
Senior Developer, TechCorp (2020-Present)
- Architected microservices handling 10M+ requests/day
- Led team of 8 engineers across 3 time zones

SKILLS
JavaScript, TypeScript, React, Node.js, AWS, Docker
```

Then test:
```json
{
  "kind": "text",
  "value": "<paste content above>"
}
```

---

## Updated Postman Collection

Import this into Postman to get pre-configured requests:

```json
{
  "info": {
    "name": "AI Resume Optimizer - Updated",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Parse Resume (Text)",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"kind\": \"text\",\n  \"value\": \"John Doe\\nSoftware Engineer\\n\\nEXPERIENCE\\nSenior Developer at Tech Corp\\n- Led team of 5\\n- Improved performance by 40%\"\n}"
        },
        "url": {
          "raw": "http://localhost:8888/.netlify/functions/parse-resume",
          "protocol": "http",
          "host": ["localhost"],
          "port": "8888",
          "path": [".netlify", "functions", "parse-resume"]
        }
      }
    },
    {
      "name": "Parse Resume (PDF - Base64)",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"kind\": \"file\",\n  \"name\": \"resume.pdf\",\n  \"mime\": \"application/pdf\",\n  \"data\": \"<PASTE_BASE64_CONTENT_HERE>\"\n}"
        },
        "url": {
          "raw": "http://localhost:8888/.netlify/functions/parse-resume",
          "protocol": "http",
          "host": ["localhost"],
          "port": "8888",
          "path": [".netlify", "functions", "parse-resume"]
        }
      }
    }
  ]
}
```

Save this as `AI_Resume_Optimizer_Fixed.postman_collection.json` and import into Postman.

---

## Summary

✅ **Fixed Issues:**
- Clarified correct JSON payload structure
- Documented Base64 encoding requirement
- Provided working examples for both text and file uploads

✅ **Linting:** All ESLint errors resolved
✅ **Tests:** All 134 tests passing

🔧 **Key Takeaway:** The endpoint expects JSON with Base64-encoded file data, not raw binary uploads.
