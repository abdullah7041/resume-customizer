import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const { userId, confirmDelete } = JSON.parse(event.body || '{}');

    if (!userId || !confirmDelete) {
      return { statusCode: 400, body: JSON.stringify({ error: 'User ID and confirmation required' }) };
    }

    // Delete in order (respecting foreign keys)
    await supabase.from('analyses').delete().eq('user_id', userId);
    await supabase.from('resumes').delete().eq('user_id', userId);
    await supabase.from('consent_records').delete().eq('user_id', userId);
    await supabase.from('profiles').delete().eq('id', userId);

    // Delete auth user
    await supabase.auth.admin.deleteUser(userId);

    // Log deletion for compliance
    await supabase.from('deletion_log').insert({
      user_id_hash: await hashUserId(userId),
      deletion_date: new Date().toISOString(),
      reason: 'USER_REQUEST_PDPL',
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: 'Account deleted' }),
    };
  } catch (error) {
    console.error('Deletion error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Deletion failed' }),
    };
  }
};

async function hashUserId(userId: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(userId + (process.env.HASH_SALT || 'default_salt'));
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
