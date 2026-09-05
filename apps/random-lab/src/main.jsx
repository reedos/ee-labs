import React from 'react'
import { createRoot } from 'react-dom/client'
import '@ee-labs/ui/base.css'
import './styles.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
