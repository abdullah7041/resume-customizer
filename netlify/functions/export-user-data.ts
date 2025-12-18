import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { initSentry, captureError } from '../lib/sentry';

initSentry();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const { userId } = JSON.parse(event.body || '{}');

    if (!userId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'User ID required' }) };
    }

    // Fetch all user data
    const [
      { data: profile },
      { data: resumes },
      { data: analyses },
      { data: consents },
    ] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).single(),
      supabase.from('resumes').select('*').eq('user_id', userId),
      supabase.from('analyses').select('*').eq('user_id', userId),
      supabase.from('consent_records').select('*').eq('user_id', userId),
    ]);

    const exportData = {
      exportDate: new Date().toISOString(),
      exportType: 'PDPL_DATA_EXPORT',
      userData: {
        profile,
        resumes,
        analyses,
        consentHistory: consents,
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
