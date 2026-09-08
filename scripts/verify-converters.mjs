import assert from 'node:assert/strict'
import {chromium} from 'playwright'
import {serveSite} from './assemble-site.mjs'
const server=await serveSite({port:0,quiet:true}),base=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch({headless:true})
try {for(const width of [1440,390,320]) {
 const page=await browser.newPage({viewport:{width,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message))
 await page.goto(`${base}/mixed-signal-lab/#c1`)
 await page.getByRole('button',{name:'Worked math',exact:true}).click()
 await page.getByLabel('Capacitor arrangement',{exact:true}).selectOption('1')
 assert(await page.locator('.lesson-schematic>figcaption').filter({hasText:'Cd is on the low bank only'}).isVisible())
 const labels=await page.locator('.lesson-schematic>.schematic .sch-label').evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect();return{text:el.textContent,x:r.x,y:r.y,right:r.right,bottom:r.bottom}}))
 assert(labels.length>=14,'All 12 bit capacitors, dummy and bridge are drawn')
 for(let i=0;i<labels.length;i++)for(let j=i+1;j<labels.length;j++){const a=labels[i],b=labels[j];assert(!(Math.min(a.right,b.right)>Math.max(a.x,b.x)+1&&Math.min(a.bottom,b.bottom)>Math.max(a.y,b.y)+1),`Overlapping labels ${a.text}/${b.text}`)}
 await page.locator('.lesson-schematic').screenshot({path:`apps/mixed-signal-lab/.shots/split-dac-${width}.png`})
 await page.getByLabel('Displayed switch phase',{exact:true}).selectOption('0')
 assert(await page.locator('.lesson-schematic>figcaption').filter({hasText:'Reset phase'}).isVisible())
 await page.getByLabel('Experiment',{exact:true}).selectOption('c5')
 await page.getByRole('button',{name:'Explore',exact:true}).click()
 for(const [name,value] of [['Bipolar input / reference','0.54'],['Common comparator-threshold shift / reference','0.3']]){const input=page.getByRole('spinbutton',{name,exact:true});await input.fill(value);await input.press('Enter')}
 assert(await page.getByRole('cell',{name:'Outside ±1',exact:true}).count()>0,'Pipeline failure remains visible')
 for(const id of ['c2','c3','c4','c6']){await page.getByLabel('Experiment',{exact:true}).selectOption(id);await page.getByRole('button',{name:'Explore',exact:true}).click();assert(!(await page.locator('table').innerText()).includes('\\times'),'Tables use plain numbers, not raw LaTeX')}
 assert.deepEqual(errors,[]);await page.close();console.log(`Converter drawing, phases, pipeline guard and table formatting passed at ${width}px`)
}}finally{await browser.close();server.close()}
