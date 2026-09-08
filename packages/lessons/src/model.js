// Lesson records keep physical models independent of their presentation.
export const fmt = (v) => !Number.isFinite(v) ? String(v) : v === 0 ? '0' : Number(v.toPrecision(6)).toString()
export const texnum = (v) => fmt(v).replace(/e([+-]?\d+)/, '\\times10^{$1}')
export const knob = (key, label, value, min, max, unit = '', step) => ({key,label,value,min,max,unit,...(step ? {step} : {})})
export const step = (title, explanation, tex, substitution) => ({title,explanation,tex,substitution})
export const reading = (label,value,unit='') => ({label,value,unit})
export const samples = (fn, lo, hi, n=161) => Array.from({length:n},(_,i)=>{const x=lo+(hi-lo)*i/(n-1);return {x,y:fn(x)}})
export const curve = (label, xLabel, yLabel, points) => ({label,xLabel,yLabel,points})
export function defaults(lesson) { return Object.fromEntries(lesson.knobs.map(k=>[k.key,typeof k.value === 'function' ? k.value() : k.value])) }
export function evaluate(lesson,p) {
  for (const k of lesson.knobs) if (!Number.isFinite(p[k.key]) || p[k.key]<k.min || p[k.key]>k.max || (k.step===1 && !Number.isInteger(p[k.key]))) throw Error(`Use ${k.label} between ${k.min} and ${k.max}${k.step===1?' as a whole number':''}.`)
  return lesson.solve(p)
}
export function grade(input, expected) {
  if (!String(input).trim() || !Number.isFinite(Number(input))) return 'Enter a finite number in the stated unit.'
  return Math.abs(Number(input)-expected)<=Math.max(Math.abs(expected)*.02,1e-12) ? 'Correct within 2%. Explain which term changes when you adjust the settings.' : 'Not yet. Check the units and the substitution in Worked math, then try again.'
}
