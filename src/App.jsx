// src/App.jsx
import React from 'react';
// Updated imports to use relative paths
import { AuthProvider, useAuth } from './hooks/useAuth.js';
import Header from './components/Layout/Header.jsx';
import Footer from './components/Layout/Footer.jsx';
import MainContent from './components/MainContent.jsx';
import { Loader2 } from 'lucide-react'; // Import loader icon

const App = () => {
  const { loading } = useAuth();

  // Show a global spinner while Supabase is checking the session on initial load.
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center">
        <Loader2 className="w-12 h-12 text-purple-600 animate-spin" />
        <p className="text-lg font-semibold text-gray-700 mt-4">Loading Application...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <Header />
      {/* The main content area grows to fill available space */}
      <main className="p-4 flex-grow">
        <MainContent />
      </main>
      <Footer />
    </div>
  );
};

// The wrapper provides the auth context to the entire app.
export default function AppWrapper() {
  return (
    <AuthProvider>
      <App />
    </AuthProvider>
  );
}

