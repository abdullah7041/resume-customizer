#!/usr/bin/env pwsh
# Automated Project Restructure Script
# This script safely migrates files to the new structure
# Run with: .\migrate-structure.ps1 -Phase <1-4> [-DryRun]

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet(1, 2, 3, 4, "all")]
    [string]$Phase,
    
    [Parameter(Mandatory=$false)]
    [switch]$DryRun = $false
)

$ErrorActionPreference = "Stop"
$script:dryRun = $DryRun
$script:changes = @()

# Colors for output
function Write-Success { param($msg) Write-Host "✅ $msg" -ForegroundColor Green }
function Write-Info { param($msg) Write-Host "ℹ️  $msg" -ForegroundColor Cyan }
function Write-Warning { param($msg) Write-Host "⚠️  $msg" -ForegroundColor Yellow }
function Write-Error { param($msg) Write-Host "❌ $msg" -ForegroundColor Red }

# Safe move function
function Move-File {
    param(
        [string]$Source,
        [string]$Destination
    )
    
    if (-not (Test-Path $Source)) {
        Write-Warning "Source not found: $Source"
        return $false
    }
    
    $destDir = Split-Path $Destination -Parent
    
    if ($script:dryRun) {
        Write-Info "[DRY RUN] Would move: $Source → $Destination"
        $script:changes += @{ Action = "Move"; Source = $Source; Dest = $Destination }
        return $true
    }
    
    # Create destination directory
    if ($destDir -and -not (Test-Path $destDir)) {
        New-Item -ItemType Directory -Path $destDir -Force | Out-Null
    }
    
    # Use git mv to preserve history
    try {
        git mv "$Source" "$Destination" 2>&1 | Out-Null
        Write-Success "Moved: $Source → $Destination"
        $script:changes += @{ Action = "Move"; Source = $Source; Dest = $Destination }
        return $true
    } catch {
        Write-Error "Failed to move: $Source"
        return $false
    }
}

# Safe delete function
function Remove-File {
    param([string]$Path)
    
    if (-not (Test-Path $Path)) {
        Write-Warning "File not found: $Path"
        return $false
    }
    
    if ($script:dryRun) {
        Write-Info "[DRY RUN] Would delete: $Path"
        $script:changes += @{ Action = "Delete"; Path = $Path }
        return $true
    }
    
    try {
        git rm -f "$Path" 2>&1 | Out-Null
        Write-Success "Deleted: $Path"
        $script:changes += @{ Action = "Delete"; Path = $Path }
        return $true
    } catch {
        Write-Error "Failed to delete: $Path"
        return $false
    }
}

# Create directory structure
function Initialize-DirectoryStructure {
    Write-Info "Creating new directory structure..."
    
    $directories = @(
        "docs/setup",
        "docs/api",
        "docs/features",
        "docs/development",
        "src/components/layout",
        "src/components/ui",
        "src/components/shared",
        "src/features/landing/components",
        "src/features/landing/hooks",
        "src/features/resume-upload/components",
        "src/features/resume-upload/hooks",
        "src/features/job-matching/components",
        "src/features/job-matching/hooks",
        "src/features/optimization/components",
        "src/features/optimization/hooks",
        "src/features/keyword-analysis/hooks",
        "src/features/cover-letter/components",
        "src/features/interview-prep/components",
        "src/features/template-gallery/data",
        "src/features/bulk-analysis",
        "src/lib/utils",
        "src/lib/parsers",
        "src/lib/ai",
        "src/styles",
        "src/types",
        "src/__tests__/unit/components",
        "src/__tests__/unit/hooks",
        "src/__tests__/unit/services",
        "src/__tests__/unit/lib",
        "src/__tests__/integration",
        "src/__tests__/fixtures",
        "netlify/functions/ai",
        "netlify/functions/resume",
        "netlify/functions/content",
        "netlify/lib/parsers",
        "scripts/diagnostics"
    )
    
    foreach ($dir in $directories) {
        if (-not (Test-Path $dir)) {
            if (-not $script:dryRun) {
                New-Item -ItemType Directory -Path $dir -Force | Out-Null
                Write-Success "Created: $dir/"
            } else {
                Write-Info "[DRY RUN] Would create: $dir/"
            }
        }
    }
}

# Phase 1: Documentation reorganization
function Invoke-Phase1 {
    Write-Host "`n📚 PHASE 1: Documentation Reorganization`n" -ForegroundColor Magenta
    
    # Setup guides
    Move-File "QUICK_START.md" "docs/setup/QUICK_START.md"
    Move-File "LOCAL_TESTING_GUIDE.md" "docs/setup/LOCAL_TESTING_GUIDE.md"
    Move-File "SUPABASE_AUTH_SETUP.md" "docs/setup/SUPABASE_AUTH_SETUP.md"
    Move-File "SUPABASE_STORAGE_SETUP.md" "docs/setup/SUPABASE_STORAGE_SETUP.md"
    
    # API documentation
    Move-File "POSTMAN_TESTING_GUIDE.md" "docs/api/POSTMAN_TESTING_GUIDE.md"
    Move-File "DEEPSEEK_OCR_BATCH_API_GUIDE.md" "docs/api/DEEPSEEK_OCR_BATCH_API_GUIDE.md"
    Move-File "DEEPSEEK_OCR_QUICK_REF.md" "docs/api/DEEPSEEK_OCR_QUICK_REF.md"
    
    # Feature documentation
    Move-File "FEATURES_QUICK_REFERENCE.md" "docs/features/FEATURES_QUICK_REFERENCE.md"
    
    # Development guides
    Move-File "QUICK_FIX_REFERENCE.md" "docs/development/QUICK_FIX_REFERENCE.md"
    Move-File "QUICK_TEST_REFERENCE.md" "docs/development/QUICK_TEST_REFERENCE.md"
    
    # Archive redundant docs
    $toArchive = @(
        "Enhancement_Suggestions.md",
        "INSTALL_FIX_SUMMARY.md",
        "IMPLEMENTATION_COMPLETE.md",
        "UI_UX_AND_AI_FIXES_SUMMARY.md",
        "SUPABASE_UPLOAD_DEBUG.md"
    )
    
    foreach ($file in $toArchive) {
        if (Test-Path $file) {
            Move-File $file "docs/archive/$file"
        }
    }
    
    # Keep in root
    Write-Info "Keeping in root: README.md, BUG_FIXES_SUMMARY.md, FIXES_SUMMARY.md"
    
    Write-Success "Phase 1 complete!"
}

# Phase 2: Component reorganization
function Invoke-Phase2 {
    Write-Host "`n🧩 PHASE 2: Component Reorganization`n" -ForegroundColor Magenta
    
    # Move layout components
    if (Test-Path "src/components/Layout") {
        Get-ChildItem "src/components/Layout" -Filter "*.jsx" | ForEach-Object {
            Move-File $_.FullName "src/components/layout/$($_.Name)"
        }
        Remove-Item "src/components/Layout" -Recurse -Force -ErrorAction SilentlyContinue
    }
    
    # Move Features to features
    if (Test-Path "src/components/Features/JobMatch.jsx") {
        Move-File "src/components/Features/JobMatch.jsx" "src/features/job-matching/JobMatch.jsx"
    }
    
    # Move features to proper locations
    $featureMap = @{
        "src/features/ResumeUpload.jsx" = "src/features/resume-upload/ResumeUpload.jsx"
        "src/features/Optimization.jsx" = "src/features/optimization/Optimization.jsx"
        "src/features/KeywordAnalyzer.jsx" = "src/features/keyword-analysis/KeywordAnalyzer.jsx"
        "src/features/CoverLetter.jsx" = "src/features/cover-letter/CoverLetter.jsx"
        "src/features/InterviewPrep.jsx" = "src/features/interview-prep/InterviewPrep.jsx"
        "src/features/TemplateGallery.jsx" = "src/features/template-gallery/TemplateGallery.jsx"
        "src/features/BulkAnalysis.jsx" = "src/features/bulk-analysis/BulkAnalysis.jsx"
    }
    
    foreach ($source in $featureMap.Keys) {
        if (Test-Path $source) {
            Move-File $source $featureMap[$source]
        }
    }
    
    # Move landing pages
    if (Test-Path "src/components/LandingPage.jsx") {
        Move-File "src/components/LandingPage.jsx" "src/features/landing/LandingPage.jsx"
    }
    
    # Delete legacy
    Remove-File "src/components/LandingPageV2.jsx"
    Remove-File "src/components/TestButton.tsx"
    
    # Move shared components
    $sharedComponents = @(
        "TemplateRenderer.jsx",
        "ProgressBar.jsx",
        "WelcomeModal.jsx"
    )
    
    foreach ($comp in $sharedComponents) {
        if (Test-Path "src/components/$comp") {
            Move-File "src/components/$comp" "src/components/shared/$comp"
        }
    }
    
    Write-Success "Phase 2 complete!"
}

# Phase 3: Eliminate duplicates and reorganize lib
function Invoke-Phase3 {
    Write-Host "`n🔧 PHASE 3: Eliminate Duplicates & Reorganize Lib`n" -ForegroundColor Magenta
    
    # Rename resumeText.js to resumeParser.js
    if (Test-Path "src/lib/resumeText.js") {
        Move-File "src/lib/resumeText.js" "src/lib/parsers/resumeParser.js"
    }
    
    if (Test-Path "src/lib/resumeText.d.ts") {
        Move-File "src/lib/resumeText.d.ts" "src/lib/parsers/resumeParser.d.ts"
    }
    
    # Backend: Rename and organize
    if (Test-Path "netlify/lib/resumeText.js") {
        Move-File "netlify/lib/resumeText.js" "netlify/lib/parsers/resumeParser.js"
    }
    
    if (Test-Path "netlify/lib/normalize-resume.js") {
        Move-File "netlify/lib/normalize-resume.js" "netlify/lib/parsers/resumeNormalizer.js"
    }
    
    # Delete shared folder
    if (Test-Path "shared/normalize-resume.js") {
        Remove-File "shared/normalize-resume.js"
    }
    
    if (Test-Path "shared") {
        Remove-Item "shared" -Recurse -Force -ErrorAction SilentlyContinue
    }
    
    # Move ai client
    if (Test-Path "src/lib/aiClient.ts") {
        Move-File "src/lib/aiClient.ts" "src/lib/ai/aiClient.ts"
    }
    
    # Move utilities
    if (Test-Path "src/lib/cn.js") {
        Move-File "src/lib/cn.js" "src/lib/utils/cn.js"
    }
    
    # Move styles
    if (Test-Path "src/App.css") {
        Move-File "src/App.css" "src/styles/App.css"
    }
    
    if (Test-Path "src/index.css") {
        Move-File "src/index.css" "src/styles/index.css"
    }
    
    # Move types
    if (Test-Path "src/vite-env.d.ts") {
        Move-File "src/vite-env.d.ts" "src/types/vite-env.d.ts"
    }
    
    Write-Success "Phase 3 complete!"
    Write-Warning "IMPORTANT: Update import paths in source files!"
}

# Phase 4: Backend and test reorganization
function Invoke-Phase4 {
    Write-Host "`n🔧 PHASE 4: Backend & Test Reorganization`n" -ForegroundColor Magenta
    
    # Backend functions grouping
    $aiFunctions = @(
        "netlify/functions/ai.ts",
        "netlify/functions/ai-match.ts",
        "netlify/functions/extract-resume-json.ts",
        "netlify/functions/optimize.ts"
    )
    
    foreach ($func in $aiFunctions) {
        if (Test-Path $func) {
            $name = Split-Path $func -Leaf
            Move-File $func "netlify/functions/ai/$name"
        }
    }
    
    $resumeFunctions = @(
        "netlify/functions/parse-resume.ts",
        "netlify/functions/match-score.ts"
    )
    
    foreach ($func in $resumeFunctions) {
        if (Test-Path $func) {
            $name = Split-Path $func -Leaf
            Move-File $func "netlify/functions/resume/$name"
        }
    }
    
    $contentFunctions = @(
        "netlify/functions/generate-cover-letter.ts",
        "netlify/functions/predict-questions.ts"
    )
    
    foreach ($func in $contentFunctions) {
        if (Test-Path $func) {
            $name = Split-Path $func -Leaf
            Move-File $func "netlify/functions/content/$name"
        }
    }
    
    # Test reorganization
    $testMap = @{
        "Button" = "components"
        "Card" = "components"
        "Header" = "components"
        "JobMatch" = "components"
        "MainContent" = "components"
        "ResumeUpload" = "components"
        "SectionTitle" = "components"
        "UploadCard" = "components"
        "mobile-layout" = "components"
        "useAuth" = "hooks"
        "useTheme" = "hooks"
        "api" = "services"
        "exportPdf" = "services"
        "supabase" = "services"
        "aiClient" = "lib"
        "assets" = "lib"
        "resumeText" = "lib"
    }
    
    foreach ($test in $testMap.Keys) {
        $category = $testMap[$test]
        $testFile = Get-ChildItem "src/__tests__" -Filter "$test.test.*" -ErrorAction SilentlyContinue | Select-Object -First 1
        
        if ($testFile) {
            Move-File $testFile.FullName "src/__tests__/unit/$category/$($testFile.Name)"
        }
    }
    
    # Delete example tests
    Remove-File "src/__tests__/helloWorld.test.ts"
    Remove-File "src/__tests__/smoke.test.jsx"
    
    # Move test utilities
    if (Test-Path "src/hooks/useTheme.test.jsx") {
        Move-File "src/hooks/useTheme.test.jsx" "src/__tests__/unit/hooks/useTheme.test.jsx"
    }
    
    # Scripts organization
    $diagnostics = @(
        "scripts/supabase-diagnostic.js",
        "scripts/validate-mobile-lighthouse.mjs",
        "scripts/validate-scroll-behavior.mjs"
    )
    
    foreach ($script in $diagnostics) {
        if (Test-Path $script) {
            $name = Split-Path $script -Leaf
            Move-File $script "scripts/diagnostics/$name"
        }
    }
    
    Write-Success "Phase 4 complete!"
}

# Main execution
function Start-Migration {
    Write-Host "`n🚀 Project Structure Migration Tool" -ForegroundColor Cyan
    Write-Host "=====================================`n" -ForegroundColor Cyan
    
    if ($script:dryRun) {
        Write-Warning "DRY RUN MODE - No changes will be made`n"
    }
    
    # Check if git repo
    if (-not (Test-Path ".git")) {
        Write-Error "Not a git repository! Please run from project root."
        exit 1
    }
    
    # Check for uncommitted changes
    $gitStatus = git status --porcelain
    if ($gitStatus -and -not $script:dryRun) {
        Write-Error "You have uncommitted changes. Please commit or stash them first."
        exit 1
    }
    
    # Create directory structure
    Initialize-DirectoryStructure
    
    # Execute phases
    switch ($Phase) {
        "1" { Invoke-Phase1 }
        "2" { Invoke-Phase2 }
        "3" { Invoke-Phase3 }
        "4" { Invoke-Phase4 }
        "all" {
            Invoke-Phase1
            Invoke-Phase2
            Invoke-Phase3
            Invoke-Phase4
        }
    }
    
    # Summary
    Write-Host "`n📊 Migration Summary" -ForegroundColor Cyan
    Write-Host "===================`n" -ForegroundColor Cyan
    
    $moveCount = ($script:changes | Where-Object { $_.Action -eq "Move" }).Count
    $deleteCount = ($script:changes | Where-Object { $_.Action -eq "Delete" }).Count
    
    Write-Host "Moved files:   $moveCount" -ForegroundColor Green
    Write-Host "Deleted files: $deleteCount" -ForegroundColor Yellow
    Write-Host "Total changes: $($script:changes.Count)`n" -ForegroundColor Cyan
    
    if (-not $script:dryRun) {
        Write-Host "Next steps:" -ForegroundColor Yellow
        Write-Host "1. Update import paths: npm run lint" -ForegroundColor Gray
        Write-Host "2. Run tests: npm test" -ForegroundColor Gray
        Write-Host "3. Test locally: netlify dev" -ForegroundColor Gray
        Write-Host "4. Commit changes: git add . && git commit -m 'chore: restructure project'" -ForegroundColor Gray
    } else {
        Write-Host "This was a dry run. Run without -DryRun to apply changes." -ForegroundColor Yellow
    }
}

# Run migration
Start-Migration
