# Pre-Deployment Validation

Run a comprehensive pre-deployment checklist before pushing to Netlify.

## Checks to Perform

### 1. Build Verification
- Run `npm run build` and capture any warnings or errors
- Verify the build completes successfully

### 2. Quality Checks
- Run `npm run quality:parallel` (lint + typecheck + tests)
- All must pass with zero errors/failures

### 3. Netlify Function Analysis
- Check every file in `netlify/functions/` for:
  - Bundle size concerns (flag any heavy imports)
  - Timeout configuration matches Netlify limits
  - Required environment variables are documented
- List ALL environment variables that must be set in Netlify dashboard

### 4. Environment Variables Audit
- Grep all source files for environment variables (`VITE_*`, `SUPABASE_*`, `OPENROUTER_*`, etc.)
- Verify each one exists in `netlify.toml`, `.env.example`, or is documented
- Flag any missing or undocumented env vars

### 5. Code Hygiene
- Check for `console.log` statements that should be removed (keep `console.error` and `console.warn`)
- Check for hardcoded `localhost` URLs
- Check for any `// TODO` or `// FIXME` comments that should be addressed

### 6. Dependency Check
- Check `package.json` for peer dependency conflicts
- Verify no deprecated packages with known vulnerabilities

### 7. Supabase Verification
- Verify all Supabase client initializations have proper error handling
- Check that server-side functions use `SUPABASE_SERVICE_ROLE_KEY` (not anon key)

## Output Format

Create a markdown report with a status for each check:
- PASS: Check passed
- WARN: Non-critical issue found
- FAIL: Critical issue that must be fixed before deploy

Fix all FAIL issues automatically. Prompt the user for WARN issues.

$ARGUMENTS
