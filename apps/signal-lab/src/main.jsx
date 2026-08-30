import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import 'katex/dist/katex.min.css'
// Shell and controls, then the math panel, then this app's own furniture.
// Order matters: the app sheet is last so it can override the shared one.
import '@ee-labs/ui/base.css'
import '@ee-labs/explain/panel.css'
import './styles.css'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
