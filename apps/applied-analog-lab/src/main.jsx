import React from 'react'
import {createRoot} from 'react-dom/client'
import {CurriculumApp} from '@ee-labs/lessons'
import {EXTENDED} from './extended.js'
import '@ee-labs/ui/base.css'
import '@ee-labs/explain/panel.css'
import 'katex/dist/katex.min.css'
createRoot(document.getElementById('root')).render(<React.StrictMode><CurriculumApp lab="applied-analog-lab" title="Applied Analog Lab" lessons={EXTENDED}/></React.StrictMode>)
