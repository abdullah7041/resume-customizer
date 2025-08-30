// src/services/supabase.js
import { createClient } from '@supabase/supabase-js';

// Get Supabase credentials from environment variables.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Check if the environment variables are set.
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase URL and Anon Key must be provided in your .env file.");
}

// Create and export the Supabase client instance.
// This single instance will be used throughout the application.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
