import { useEffect, useRef, useState } from 'react'

export const PLAYBACK_SPEEDS = [0.25, 0.5, 1, 2, 4]
export const advancePlayback = (position, elapsed, duration, speed) =>
  Math.min(1, Math.max(0, position + Math.max(0, elapsed) * speed / duration))

// Circuit Elements' wall-clock cursor and Control's transport rules, shared by
// the new labs. The physical time window remains the caller's responsibility.
export function usePlayback({ duration = 12000, resetKey } = {}) {
  const [position, updatePosition] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const current = useRef(0)
  const setPosition = (value) => {
    current.current = Math.max(0, Math.min(1, value))
    updatePosition(current.current)
    setPlaying(false)
  }
  const reset = () => setPosition(0)
  useEffect(() => { reset() }, [resetKey])
  useEffect(() => {
    if (!playing) return undefined
    let frame
    let previous = null
    const tick = (now) => {
      if (previous !== null) {
        current.current = advancePlayback(current.current, now - previous, duration, speed)
        updatePosition(current.current)
      }
      previous = now
      if (current.current >= 1) setPlaying(false)
      else frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [playing, duration, speed])
  const toggle = () => {
    if (!playing && current.current >= 1) {
      current.current = 0
      updatePosition(0)
    }
    setPlaying((value) => !value)
  }
  return { position, setPosition, playing, speed, setSpeed, toggle, reset }
}
