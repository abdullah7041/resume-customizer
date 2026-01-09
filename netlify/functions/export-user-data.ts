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

    // 3. Use authenticated user's ID (ignore client-supplied userId)
    const userId = user.id;

    // 4. Switch to service role for data retrieval (now safe)
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 5. Fetch all user data for authenticated user only
    const [
      { data: profile },
      { data: resumes },
      { data: jobMatches },
      { data: jobApplications },
    ] = await Promise.all([
      supabase.from('user_profiles').select('*').eq('id', userId).single(),
      supabase.from('resumes').select('*').eq('user_id', userId),
      supabase.from('job_matches').select('*').eq('user_id', userId),
      supabase.from('job_applications').select('*').eq('user_id', userId),
    ]);

    const exportData = {
      exportDate: new Date().toISOString(),
      exportType: 'GDPR_DATA_EXPORT',
      userData: {
        profile,
        resumes,
        jobMatches,
        jobApplications,
      },
    };

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="user-data-export-${userId}.json"`,
      },
      body: JSON.stringify(exportData, null, 2),
    };
  } catch (error) {
    console.error('Export error:', error);
    captureError(error, {
      function: 'export-user-data',
    });
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Export failed' }),
    };
  }
};
