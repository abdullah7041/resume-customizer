// src/main.jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
// CORRECTED: Import the AppWrapper which includes the AuthProvider
import AppWrapper from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppWrapper />
  </React.StrictMode>,
)

