import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const repoRoot = process.cwd();
const sourceRoot = join(repoRoot, 'src');

const sourceExtensions = new Set(['.js', '.jsx', '.ts', '.tsx']);
const privilegedRpcNames = [
  'add_credits',
  'add_feedback_credits',
  'consume_user_credits',
  'initialize_user_credits',
  'rls_auto_enable',
  'submit_feedback_report',
];

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      return listFiles(fullPath);
    }
    return [fullPath];
  });
}

function isSourceFile(filePath: string) {
  return [...sourceExtensions].some((extension) => filePath.endsWith(extension));
}

function isProductionSource(filePath: string) {
  const normalized = relative(sourceRoot, filePath).replace(/\\/g, '/');
  return (
    isSourceFile(filePath) &&
    !normalized.includes('/__tests__/') &&
    !normalized.endsWith('.test.ts') &&
    !normalized.endsWith('.test.tsx') &&
    !normalized.endsWith('.test.js') &&
    !normalized.endsWith('.test.jsx')
  );
}

function readProductionSources() {
  return listFiles(sourceRoot)
    .filter(isProductionSource)
    .map((filePath) => ({
      filePath,
      relativePath: relative(repoRoot, filePath).replace(/\\/g, '/'),
      content: readFileSync(filePath, 'utf8'),
    }));
}

describe('client security boundaries', () => {
  it('does not call privileged Supabase RPCs from frontend production code', () => {
    const offenders = readProductionSources().flatMap(({ relativePath, content }) => {
      if (!content.includes('.rpc(')) return [];
      return privilegedRpcNames
        .filter((rpcName) => content.includes(rpcName))
        .map((rpcName) => `${relativePath}: ${rpcName}`);
    });

    expect(offenders).toEqual([]);
  });

  it('keeps service-role credentials out of frontend production code and Vite config', () => {
    const serviceRoleKey = 'SUPABASE_' + 'SERVICE_' + 'ROLE_KEY';
    const serviceRoleName = 'service_' + 'role';
    const files = [
      ...readProductionSources(),
      {
        relativePath: 'vite.config.js',
        content: readFileSync(join(repoRoot, 'vite.config.js'), 'utf8'),
      },
    ];

    const offenders = files.flatMap(({ relativePath, content }) => {
      const matches = [];
      if (content.includes(serviceRoleKey)) matches.push(`${relativePath}: ${serviceRoleKey}`);
      if (content.includes(serviceRoleName)) matches.push(`${relativePath}: ${serviceRoleName}`);
      return matches;
    });

    expect(offenders).toEqual([]);
  });
});
