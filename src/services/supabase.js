import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Auth functions
export const authService = {
  signUp: async (email, password, metadata = {}) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          nationality: metadata.nationality,
          preferred_language: metadata.language || 'en'
        }
      }
    })
    return { data, error }
  },

  signIn: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    return { data, error }
  },

  signOut: async () => {
    const { error } = await supabase.auth.signOut()
    return { error }
  }
}

// Resume storage
export const resumeService = {
  saveResume: async (userId, resumeData) => {
    const { data, error } = await supabase
      .from('resumes')
      .insert({
        user_id: userId,
        resume_data: resumeData,
        created_at: new Date().toISOString()
      })
    return { data, error }
  },

  getResumes: async (userId) => {
    const { data, error } = await supabase
      .from('resumes')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    return { data, error }
  }
}