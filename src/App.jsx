import React from 'react'
import ResumeOptimizer from './components/ResumeOptimizer'
import { supabase } from './services/supabase'

function App() {
  React.useEffect(() => {
    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('Session:', session)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('Auth changed:', session)
    })

    return () => subscription.unsubscribe()
  }, [])

  return <ResumeOptimizer />
}

export default App