import React from 'react'
import { createRoot } from 'react-dom/client'
import '@ee-labs/ui/base.css'
import '@ee-labs/explain/panel.css'
import 'katex/dist/katex.min.css'
import './styles.css'
import Foundation from './App.jsx'
import {CurriculumApp} from '@ee-labs/lessons'
import {EXPERIMENTS} from './experiments.js'
import {EXTENDED} from './extended.js'
const App = () => <CurriculumApp lab="interfaces-lab" title="Interfaces Lab" foundation={Foundation} foundations={EXPERIMENTS} lessons={EXTENDED}/>

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>)
