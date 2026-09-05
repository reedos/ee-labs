import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
// Shell and controls first, then this app's own furniture, so the app sheet
// can override the shared one.
import '@ee-labs/ui/base.css'
import './styles.css'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
