import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {it,expect} from 'vitest'
import {EXPERIMENTS,defaultsOf,drawables} from './experiments.js'
import {analyse,snapNoise} from './math.js'
import {layoutProblems} from './layoutCheck.js'
import {StatePane} from './components/panes.jsx'
it('new schematics have readable labels and expose every named node',()=>{
  const failures=[]
  for(const e of EXPERIMENTS.filter(e=>e.study)){
    const p=defaultsOf(e.id),x=analyse(e,p),dots=new Set(e.layout.items.filter(it=>it.node).map(it=>it.node))
    for(const node of new Set(x.net.elements.flatMap(e=>e.nodes)))if(node!=='gnd'&&!dots.has(node))failures.push(`${e.id}: missing node ${node}`)
    for(const show of ['i','v','p'])failures.push(...layoutProblems(e.layout,drawables(x.net),snapNoise(x.sol),show).map(s=>`${e.id} ${show}: ${s}`))
  }
  expect(failures).toEqual([])
})
it('the coupled-winding state table checks the mutual-voltage law',()=>{
  const e=EXPERIMENTS.find(e=>e.id==='l1')
  for(const opposed of [false,true]){
    const x=analyse(e,{...defaultsOf(e.id),opposed},.003)
    const html=renderToStaticMarkup(<StatePane x={x} worked={false}/>)
    expect(html).toContain('mutual voltage')
    expect(html).not.toContain('class="disagree"')
  }
})
