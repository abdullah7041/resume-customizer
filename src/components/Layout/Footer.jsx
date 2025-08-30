// src/components/Layout/Footer.jsx
import React from 'react';
import { Shield } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="bg-white/95 backdrop-blur-xl p-6 mt-1 border-t border-gray-200">
      <div className="max-w-6xl mx-auto flex flex-wrap justify-between items-center text-sm text-gray-600 gap-4">
        <div className="flex items-center space-x-4">
          <a href="#" className="hover:text-purple-600 transition-colors">Privacy Policy</a>
          <a href="#" className="hover:text-purple-600 transition-colors">Terms of Service</a>
        </div>
        <div className="flex items-center space-x-2 text-green-700">
          <Shield className="w-4 h-4" />
          <span>Your data is encrypted and secure</span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
