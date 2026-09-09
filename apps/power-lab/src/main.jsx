import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import {parseLink} from '@ee-labs/ui'
import {buckFromLink} from './fromLink.js'
import 'katex/dist/katex.min.css'
import '@ee-labs/ui/base.css'
import '@ee-labs/explain/panel.css'
import './styles.css'

const fragment=window.location.hash
let incoming=null
if(fragment.includes('=')){
 try{const {patch,warnings}=parseLink(fragment);incoming=warnings.length?{error:'The linked operating point contains unsupported values.'}:buckFromLink(patch)}catch{incoming={error:'The linked operating point could not be read.'}}
}
createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App {...(incoming?.error?{}:incoming??{})} incomingMessage={incoming?.error??(incoming?'Imported ideal buck operating point. Efficiency and noise assumptions were not transferred.':null)} incomingError={!!incoming?.error}/>
  </React.StrictMode>,
)
