// FIXED: Removed the import for the conflicting App.css file.
// import './App.css'; 
import React from 'react';
import { AuthProvider, useAuth } from './hooks/useAuth.jsx';
import Header from './components/Layout/Header.jsx';
import Footer from './components/Layout/Footer.jsx';
import MainContent from './components/MainContent.jsx';
import { Loader2 } from 'lucide-react';

const App = () => {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center">
        <Loader2 className="w-12 h-12 text-purple-600 animate-spin" />
        <p className="text-lg font-semibold text-gray-700 mt-4">Loading Application...</p>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-purple-700 p-4">
      <div className="flex flex-col min-h-[calc(100vh-2rem)]">
        <Header />
        <main className="flex-grow my-4">
          <MainContent />
        </main>
        <Footer />
      </div>
    </div>
  );
};

export default function AppWrapper() {
  return (
    <AuthProvider>
      <App />
    </AuthProvider>
  );
}