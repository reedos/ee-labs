import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import {CurriculumApp} from '@ee-labs/lessons'
import {EXPERIMENTS} from './experiments.js'
import {EXTENDED} from './extended.js'
import 'katex/dist/katex.min.css'
import '@ee-labs/explain/panel.css'
import '@ee-labs/ui/base.css'
import './styles.css'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <CurriculumApp lab="photonics-lab" title="Photonics Lab" foundation={App} foundations={EXPERIMENTS} lessons={EXTENDED}/>
  </React.StrictMode>,
)
