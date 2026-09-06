import React, { useEffect, useState } from 'react'
import App from './App.jsx'
import PhasorCourse from './components/PhasorCourse.jsx'
import { PHASOR_LESSONS } from './phasorCourse.js'

export function courseRoute(hash, search = '') {
  const params = new URLSearchParams(hash.replace(/^#/, ''))
  // Existing circuit links remain the authority for incoming component values.
  if (params.has('circuit')) return null
  if (!hash || hash === '#') return new URLSearchParams(search).get('course') === 'frequency' ? null : PHASOR_LESSONS[0].id
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
  return route ? <PhasorCourse key={route} lessonId={route} /> : <App key={hash} />
}
