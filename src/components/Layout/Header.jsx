// src/components/Layout/Header.jsx
import React from 'react';
// FIXED: Changed the broken '@/' alias to the correct relative path.
import { useAuth } from '../../hooks/useAuth.jsx';

const Header = () => {
  const { user, signOut } = useAuth();

  return (
    <header className="bg-gradient-to-r from-primary to-secondary text-white p-6">
      <div className="max-w-6xl mx-auto flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">AI Resume Optimizer</h1>
          <p className="text-md opacity-90 mt-1">By Abdullah bin ahmed.</p>
        </div>
        {user && (
          <div className="flex items-center space-x-4">
            <span className="text-sm hidden sm:block">Welcome, {user.email}</span>
            <button 
              onClick={signOut} 
              className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition-colors font-semibold"
            >
              Sign Out
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;