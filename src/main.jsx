// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import AppWrapper from './App.jsx';

// FIXED: This line imports all your Tailwind styles
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppWrapper />
  </React.StrictMode>,
);

