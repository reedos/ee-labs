import React from 'react'
import { createRoot } from 'react-dom/client'
import Foundation from './App.jsx'
import {CurriculumApp} from '@ee-labs/lessons'
import {EXPERIMENTS} from './experiments.js'
import {EXTENDED} from './extended.js'
import '@ee-labs/explain/panel.css'
import 'katex/dist/katex.min.css'
const App = () => <CurriculumApp lab="rf-lab" title="RF Lab" foundation={Foundation} foundations={EXPERIMENTS} lessons={EXTENDED}/>
import '@ee-labs/ui/base.css'
import './styles.css'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
