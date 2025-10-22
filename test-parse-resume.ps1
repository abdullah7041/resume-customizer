#!/usr/bin/env pwsh
# PowerShell script to convert resume PDF to Base64 and test the parse-resume endpoint
# Usage: .\test-parse-resume.ps1 <path-to-resume.pdf>

param(
    [Parameter(Mandatory=$true)]
    [string]$ResumePath,
    
    [Parameter(Mandatory=$false)]
    [string]$EndpointUrl = "http://localhost:8888/.netlify/functions/parse-resume"
)

# Check if file exists
if (-not (Test-Path $ResumePath)) {
    Write-Error "❌ File not found: $ResumePath"
    exit 1
}

# Get file info
$file = Get-Item $ResumePath
$fileName = $file.Name
$extension = $file.Extension.ToLower()

# Determine MIME type
$mimeType = switch ($extension) {
    ".pdf"  { "application/pdf" }
    ".docx" { "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }
    ".txt"  { "text/plain" }
    default { 
        Write-Error "❌ Unsupported file type: $extension (only .pdf, .docx, .txt supported)"
        exit 1
    }
}

Write-Host "📄 Converting file to Base64..." -ForegroundColor Cyan
Write-Host "   File: $fileName" -ForegroundColor Gray
Write-Host "   Size: $([Math]::Round($file.Length / 1KB, 2)) KB" -ForegroundColor Gray
Write-Host "   Type: $mimeType" -ForegroundColor Gray
Write-Host ""

# Read file and convert to Base64
try {
    $fileBytes = [System.IO.File]::ReadAllBytes($ResumePath)
    $base64Content = [System.Convert]::ToBase64String($fileBytes)
    
    Write-Host "✅ Base64 conversion successful" -ForegroundColor Green
    Write-Host "   Base64 length: $($base64Content.Length) characters" -ForegroundColor Gray
    Write-Host ""
} catch {
    Write-Error "❌ Failed to read file: $_"
    exit 1
}

# Create JSON payload
$payload = @{
    kind = "file"
    name = $fileName
    mime = $mimeType
    data = $base64Content
} | ConvertTo-Json -Depth 10

# Send request
Write-Host "🚀 Sending request to $EndpointUrl..." -ForegroundColor Cyan
Write-Host ""

try {
    $response = Invoke-RestMethod `
        -Uri $EndpointUrl `
        -Method Post `
        -ContentType "application/json" `
        -Body $payload `
        -ErrorAction Stop
    
    Write-Host "✅ Request successful!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📋 Response:" -ForegroundColor Yellow
    Write-Host "─────────────────────────────────────────────" -ForegroundColor Gray
    
    # Pretty print response
    $response | ConvertTo-Json -Depth 10 | Write-Host
    
    Write-Host ""
    Write-Host "─────────────────────────────────────────────" -ForegroundColor Gray
    Write-Host ""
    
    # Display summary
    if ($response.document) {
        $doc = $response.document
        Write-Host "📊 Document Summary:" -ForegroundColor Cyan
        Write-Host "   Plain text length: $($doc.plainText.Length) characters" -ForegroundColor Gray
        Write-Host "   Bullets found: $($doc.bullets.Count)" -ForegroundColor Gray
        Write-Host "   Sections found: $($doc.sections.Count)" -ForegroundColor Gray
        
        if ($doc.sections.Count -gt 0) {
            Write-Host ""
            Write-Host "   📑 Sections:" -ForegroundColor Cyan
            foreach ($section in $doc.sections) {
                Write-Host "      • $($section.title)" -ForegroundColor Gray
            }
        }
        
        Write-Host ""
        Write-Host "   First 200 characters of plain text:" -ForegroundColor Cyan
        $preview = $doc.plainText.Substring(0, [Math]::Min(200, $doc.plainText.Length))
        Write-Host "   $preview..." -ForegroundColor Gray
    }
    
    Write-Host ""
    Write-Host "✨ All done!" -ForegroundColor Green
    
} catch {
    Write-Host "❌ Request failed!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Error details:" -ForegroundColor Yellow
    Write-Host $_.Exception.Message -ForegroundColor Red
    
    if ($_.ErrorDetails.Message) {
        Write-Host ""
        Write-Host "Server response:" -ForegroundColor Yellow
        try {
            $errorResponse = $_.ErrorDetails.Message | ConvertFrom-Json
            $errorResponse | ConvertTo-Json -Depth 10 | Write-Host -ForegroundColor Red
        } catch {
            Write-Host $_.ErrorDetails.Message -ForegroundColor Red
        }
    }
    
    Write-Host ""
    Write-Host "💡 Troubleshooting tips:" -ForegroundColor Yellow
    Write-Host "   1. Make sure netlify dev is running on port 8888" -ForegroundColor Gray
    Write-Host "   2. Check if the file is a valid PDF/DOCX (not scanned images)" -ForegroundColor Gray
    Write-Host "   3. Ensure file size is under 8 MB" -ForegroundColor Gray
    Write-Host "   4. See POSTMAN_TESTING_GUIDE.md for more details" -ForegroundColor Gray
    
    exit 1
}
