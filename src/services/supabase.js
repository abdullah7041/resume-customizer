// src/services/auth.ts
import { supabase } from "./supabaseClient"

export const signInWithGoogle = async () => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: import.meta.env.DEV
        ? "http://localhost:5173/"
        : "https://resume-optimizing.netlify.app/"
    }
  })
  if (error) throw error
  return data
}
