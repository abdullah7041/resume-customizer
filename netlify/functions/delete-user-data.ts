import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { initSentry, captureError } from '../lib/sentry';

initSentry();

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    // 1. Extract and validate auth token
    const authHeader = event.headers.authorization || event.headers.Authorization;
    if (!authHeader) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
    }

    // 2. Verify token and get authenticated user
    const token = authHeader.replace(/^Bearer\s+/i, '');
    const supabaseAnon = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!
    );
    const { data: { user }, error: authError } = await supabaseAnon.auth.getUser(token);

    if (authError || !user) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Invalid token' }) };
    }

    // 3. Parse request body
    const { confirmDelete } = JSON.parse(event.body || '{}');

    if (!confirmDelete) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Confirmation required' }) };
    }

    // 4. Use authenticated user's ID (ignore client-supplied userId)
    const userId = user.id;

    // 5. Switch to service role for deletion operations
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 6. Delete data for authenticated user only
    // Delete in order (respecting foreign keys)
    // Foreign key constraints handle cascade deletion for job_applications
    await supabase.from('job_matches').delete().eq('user_id', userId);
    await supabase.from('resumes').delete().eq('user_id', userId);
    await supabase.from('user_profiles').delete().eq('id', userId);

    // Delete auth user (this will cascade delete due to foreign key constraints)
    await supabase.auth.admin.deleteUser(userId);

    // 7. Log deletion for compliance (recommended)
    console.log(`User ${userId} deleted their account at ${new Date().toISOString()}`);

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: 'Account deleted' }),
    };
  } catch (error) {
    console.error('Deletion error:', error);
    captureError(error, {
      function: 'delete-user-data',
    });
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Deletion failed' }),
    };
  }
};
