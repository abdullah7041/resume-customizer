import { build } from "vite";
import { writeFile } from "node:fs/promises";

process.env.VITE_BUILD_ID = Date.now().toString();
process.env.VITE_DEPLOY_CONTEXT = process.env.CONTEXT || 'development';
process.env.VITE_SENTRY_RELEASE ||= process.env.COMMIT_REF || process.env.VITE_BUILD_ID;

try {
  await build();
  if (process.env.CONTEXT && /^[0-9a-f]{40}$/.test(process.env.COMMIT_REF || '')) {
    // Netlify bundles functions after the build. Build-only variables may be absent at invocation.
    await writeFile('netlify/lib/deploy-context.json', JSON.stringify({ context: process.env.CONTEXT, commit: process.env.COMMIT_REF }));
  }
  if (process.env.CONTEXT === 'production' && /^[0-9a-f]{40}$/.test(process.env.COMMIT_REF || '')) {
    await writeFile('dist/autofix-release.json', JSON.stringify({ commit: process.env.COMMIT_REF }));
  }
} catch (error) {
  console.error(error);
  process.exit(1);
}

