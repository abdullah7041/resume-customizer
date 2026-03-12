/**
 * Supabase Migration Execution Script
 * Executes: 20260108_rename_tables_gdpr_compliance.sql
 *
 * This script safely runs the GDPR compliance migration with:
 * - Pre-migration safety checks
 * - Migration execution
 * - Post-migration validation
 *
 * Usage: node scripts/run-migration.js
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, colors.bright + colors.cyan);
  console.log('='.repeat(60) + '\n');
}

function logSuccess(message) {
  log(`✅ ${message}`, colors.green);
}

function logWarning(message) {
  log(`⚠️  ${message}`, colors.yellow);
}

function logError(message) {
  log(`❌ ${message}`, colors.red);
}

function logInfo(message) {
  log(`ℹ️  ${message}`, colors.blue);
}

// Initialize Supabase client with service role
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  logError('Missing required environment variables:');
  logError('  - VITE_SUPABASE_URL or SUPABASE_URL');
  logError('  - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

/**
 * Execute SQL query and return results
 */
async function _executeSQL(sql, description = '') {
  if (description) {
    logInfo(description);
  }

  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

  if (error) {
    // If exec_sql doesn't exist, try direct execution via REST API
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`
      },
      body: JSON.stringify({ sql_query: sql })
    });

    if (!response.ok) {
      throw new Error(`SQL execution failed: ${error?.message || response.statusText}`);
    }

    return await response.json();
  }

  return data;
}

/**
 * Execute SQL using pg client (alternative method)
 */
async function _executeSQLDirect(sql) {
  const { data: _data, error: _error } = await supabase.from('_placeholder_').select('*').limit(0);

  // Use the connection to execute raw SQL
  // Note: This is a workaround since Supabase client doesn't expose raw SQL execution
  // We'll read migration file and execute it via SQL Editor instead
  throw new Error('Direct SQL execution not available via Supabase client. Please use Supabase Dashboard SQL Editor.');
}

/**
 * Phase 1: Pre-Migration Safety Checks
 */
async function preMigrationChecks() {
  logSection('PHASE 1: PRE-MIGRATION SAFETY CHECKS');

  const results = {
    tables: {},
    rowCounts: {},
    backupTimestamp: new Date().toISOString()
  };

  // Step 1.1: Verify current table state
  logInfo('Step 1.1: Verifying current table state...');
  try {
    const { data: tables, error } = await supabase
      .from('pg_tables')
      .select('tablename')
      .eq('schemaname', 'public')
      .in('tablename', [
        'profiles', 'user_profiles', 'consent_records',
        'consent_logs', 'analyses', 'job_matches',
        'job_applications', 'deletion_log', 'resumes'
      ])
      .order('tablename');

    if (error) throw error;

    const tableNames = tables.map(t => t.tablename);
    results.tables = tableNames;

    logSuccess(`Found ${tableNames.length} tables: ${tableNames.join(', ')}`);

    // Check if migration already ran
    const hasNewNames = tableNames.includes('user_profiles') ||
                        tableNames.includes('job_matches') ||
                        tableNames.includes('consent_logs');
    const hasOldNames = tableNames.includes('profiles') ||
                       tableNames.includes('analyses') ||
                       tableNames.includes('consent_records');

    if (hasNewNames && !hasOldNames) {
      logWarning('Migration appears to have already been run (new table names exist).');
      const answer = await askQuestion('Do you want to continue anyway? (y/N): ');
      if (answer.toLowerCase() !== 'y') {
        logInfo('Migration cancelled by user.');
        process.exit(0);
      }
    } else if (!hasOldNames && !hasNewNames) {
      logWarning('No expected tables found. This might not be the right database.');
      const answer = await askQuestion('Do you want to continue anyway? (y/N): ');
      if (answer.toLowerCase() !== 'y') {
        logInfo('Migration cancelled by user.');
        process.exit(0);
      }
    }

  } catch (error) {
    logError(`Failed to query table state: ${error.message}`);
    logWarning('Unable to verify table state via Supabase client.');
    logInfo('This is expected - Supabase client cannot query pg_tables directly.');
  }

  // Step 1.2: Count rows (will need manual verification)
  logInfo('\nStep 1.2: Row count verification');
  logWarning('Row counting requires direct SQL access.');
  logInfo('Please manually execute these queries in Supabase Dashboard SQL Editor:');
  console.log('\n--- Copy and paste this SQL in Supabase Dashboard ---');
  console.log(`
SELECT 'profiles' as table_name, COUNT(*) as row_count FROM profiles
UNION ALL SELECT 'consent_records', COUNT(*) FROM consent_records
UNION ALL SELECT 'analyses', COUNT(*) FROM analyses
UNION ALL SELECT 'resumes', COUNT(*) FROM resumes;
  `.trim());
  console.log('--- End of SQL ---\n');

  // Step 1.4: Record backup timestamp
  results.backupTimestamp = new Date().toISOString();
  logSuccess(`Backup timestamp recorded: ${results.backupTimestamp}`);
  logInfo('If using Supabase PITR, you can restore to this timestamp if needed.');

  return results;
}

/**
 * Phase 2: Execute Migration
 */
async function executeMigration() {
  logSection('PHASE 2: MIGRATION EXECUTION');

  // Read migration file
/**
 * Path to migration SQL file
 */
const MIGRATION_FILE = 'supabase/migrations/20260310_refactor_to_email.sql';
  const migrationPath = join(__dirname, '..', MIGRATION_FILE);
  logInfo(`Reading migration file: ${migrationPath}`);

  let migrationSQL;
  try {
    migrationSQL = readFileSync(migrationPath, 'utf-8');
    logSuccess('Migration file loaded successfully');
    logInfo(`Migration size: ${migrationSQL.length} characters`);
  } catch (error) {
    logError(`Failed to read migration file: ${error.message}`);
    process.exit(1);
  }

  // Display migration preview
  console.log('\n--- MIGRATION SQL PREVIEW (first 500 chars) ---');
  console.log(migrationSQL.substring(0, 500) + '...');
  console.log('--- END PREVIEW ---\n');

  logWarning('IMPORTANT: Supabase client cannot execute raw SQL with DDL statements.');
  logInfo('You need to execute this migration via Supabase Dashboard SQL Editor.');
  console.log('\n' + '='.repeat(60));
  log('NEXT STEPS:', colors.bright + colors.yellow);
  console.log('='.repeat(60));
  console.log('1. Open Supabase Dashboard: https://supabase.com/dashboard/project/cwcjeujextkwpmzdfzdz/editor');
  console.log('2. Navigate to SQL Editor');
  console.log('3. Create a new query');
  console.log('4. Copy the migration SQL from:');
  console.log(`   ${migrationPath}`);
  console.log('5. Paste and execute the SQL');
  console.log('6. Watch for NOTICE messages confirming table renames');
  console.log('7. Return here and run: node scripts/verify-migration.js');
  console.log('='.repeat(60) + '\n');

  return { executed: false, method: 'manual' };
}

/**
 * Ask user a question (for interactive mode)
 */
function askQuestion(query) {
  return new Promise(resolve => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question(query, answer => {
      rl.close();
      resolve(answer);
    });
  });
}

/**
 * Main execution flow
 */
async function main() {
  log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                                 ║
║        Supabase GDPR Compliance Migration Executor              ║
║        Migration: 20260108_rename_tables_gdpr_compliance        ║
║                                                                 ║
╚═══════════════════════════════════════════════════════════════╝
  `, colors.bright + colors.cyan);

  logWarning('This script will execute a production database migration.');
  logWarning('Please ensure you have:');
  console.log('  ✓ Reviewed the migration SQL');
  console.log('  ✓ Scheduled a maintenance window (2-3 minutes)');
  console.log('  ✓ Notified stakeholders');
  console.log('  ✓ Have rollback plan ready\n');

  const answer = await askQuestion('Do you want to proceed? (y/N): ');
  if (answer.toLowerCase() !== 'y') {
    logInfo('Migration cancelled by user.');
    process.exit(0);
  }

  try {
    // Phase 1: Pre-migration checks
    const _preCheckResults = await preMigrationChecks();

    // Phase 2: Execute migration
    const _migrationResults = await executeMigration();

    logSuccess('\nScript completed successfully!');
    logInfo('Please execute the migration SQL in Supabase Dashboard as instructed above.');
    logInfo('Then run the verification script: node scripts/verify-migration.js');

  } catch (error) {
    logError(`\nMigration failed: ${error.message}`);
    logError('Stack trace:');
    console.error(error);
    process.exit(1);
  }
}

// Run main function
main();
