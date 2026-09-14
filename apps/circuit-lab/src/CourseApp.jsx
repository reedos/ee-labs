import React, { useEffect, useState } from 'react'
import App from './App.jsx'
const destinations = {complex:'h2&view=phasor',series:'h3&view=phasor',nodal:'h8&view=phasor',power:'h8&view=acpower'}
import { PHASOR_LESSONS } from './phasorCourse.js'

export function courseRoute(hash, search = '') {
  const params = new URLSearchParams(hash.replace(/^#/, ''))
  // Existing circuit links remain the authority for incoming component values.
  if (params.has('circuit')) return null
  if (!hash || hash === '#') return null
  if (!params.has('phasors')) return null
  const id = params.get('phasors')
  return PHASOR_LESSONS.some(l => l.id === id) ? id : PHASOR_LESSONS[0].id
}

export default function CourseApp() {
  const [hash, setHash] = useState(() => window.location.hash)
  useEffect(() => {
    const update = () => setHash(window.location.hash)
    window.addEventListener('hashchange', update)
    return () => window.removeEventListener('hashchange', update)
  }, [])
  const route = courseRoute(hash, window.location.search)
  useEffect(() => {
    if (route) window.location.replace(`../circuit-elements-lab/#${destinations[route]}`)
  }, [route])
  return route ? <p>Opening this experiment in <a href={`../circuit-elements-lab/#${destinations[route]}`}>Circuit Elements</a>.</p> : <App key={hash} />
}
