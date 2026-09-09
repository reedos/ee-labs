import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {chromium} from 'playwright'
import {serveSite} from './assemble-site.mjs'
import {DYNAMIC_LESSONS} from '../apps/mixed-signal-lab/src/dynamicLessons.js'
import {density} from '../apps/mixed-signal-lab/src/dynamic.js'
import {defaults,evaluate} from '../packages/lessons/src/model.js'
const live=process.argv.includes('--live'),server=live?null:await serveSite({port:0,quiet:true}),base=live?'https://reedos.github.io/ee-labs':`http://127.0.0.1:${server.address().port}`
const browser=await chromium.launch({headless:true}),shots='apps/mixed-signal-lab/.shots';await mkdir(shots,{recursive:true})
try{for(const width of [1440,390,320]){
 const page=await browser.newPage({viewport:{width,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message))
 const set=async(label,value)=>{const c=page.getByRole('spinbutton',{name:label,exact:true});await c.fill(value);await c.press('Enter')}
 const clean=async()=>{assert.equal(await page.getByRole('alert').count(),0);assert.equal(await page.locator('.katex-error').count(),0);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert(!await page.locator('.lesson-plot path').evaluateAll(els=>els.some(el=>/NaN|Infinity/.test(el.getAttribute('d')??''))))}
 for(const lesson of DYNAMIC_LESSONS){
  await page.goto(`${base}/mixed-signal-lab/#${lesson.id}`)
  assert.equal(await page.getByLabel('Experiment',{exact:true}).locator('option').count(),29)
  let geometry
  for(const view of ['Start here','Worked math','Explore','Practice']){
   await page.getByRole('button',{name:view,exact:true}).click();await clean()
   const next=await page.locator('.lesson-tabs button').evaluateAll(els=>els.map(e=>[e.offsetLeft,e.offsetTop,e.offsetWidth,e.offsetHeight]));geometry??=next;assert.deepEqual(next,geometry)
   if(view==='Worked math'){assert(await page.locator('.lesson-step').count()>=4);await page.screenshot({path:`${shots}/${live?'live-':''}${lesson.id}-math-${width}.png`,fullPage:true})}
   if(view==='Explore'){
    assert(!await page.locator('.lesson-table-wrap tr').evaluateAll(rows=>rows.some(row=>row.cells.length!==row.closest('table').tHead.rows[0].cells.length)))
    assert(!(await page.locator('.lesson-table-wrap').innerText()).includes('\\times'))
   }
   if(view==='Practice'){
    const answer=evaluate(lesson,defaults(lesson)).practice.answer
    await page.locator('.lesson-practice input').fill(String(answer));await page.getByRole('button',{name:'Check answer',exact:true}).click()
    assert(await page.getByRole('status').filter({hasText:'Correct within 2%'}).isVisible())
   }
  }
 }
 await page.goto(`${base}/mixed-signal-lab/#d1`);await page.getByRole('button',{name:'Explore',exact:true}).click()
 assert(await page.getByText('log scale; display floor',{exact:false}).isVisible())
 const graph=page.locator('.lesson-plot').first(),paths=await graph.locator('svg>path').evaluateAll(els=>els.map(el=>el.getAttribute('d')))
 assert(paths.length>=2)
 // A one-pole exponential is a straight line on this logarithmic ordinate.
 const points=paths[0].slice(1).split('L').map(s=>s.split(',').map(Number)),mid=points[Math.floor(points.length/2)]
 assert(Math.abs(mid[1]-(points[0][1]+points.at(-1)[1])/2)<.01,'Logarithmic error curve should be straight')
 await graph.screenshot({path:`${shots}/${live?'live-':''}d1-error-${width}.png`})
 await page.goto(`${base}/mixed-signal-lab/#d2`);await page.getByRole('button',{name:'Explore',exact:true}).click();await set('Signed target step','0e0');assert(await page.getByText('A zero step starts inside tolerance',{exact:false}).isVisible());await clean()
 await set('Signed target step','-1e0');await clean();assert((await page.locator('.lesson-results').innerText()).includes('28.6684'))
 await page.goto(`${base}/mixed-signal-lab/#d3`);await page.getByRole('button',{name:'Enlarge circuit',exact:true}).click();await page.getByRole('dialog').screenshot({path:`${shots}/${live?'live-':''}d3-circuit-${width}.png`});await page.keyboard.press('Escape')
 await set('Initial differential magnitude','0e0');await page.getByRole('button',{name:'Worked math',exact:true}).click();assert(await page.getByText('no finite decision time',{exact:false}).count());await clean()
 await page.goto(`${base}/mixed-signal-lab/#d4`);await page.getByRole('button',{name:'Explore',exact:true}).click()
 for(const value of ['0','1','2','3','4']){await page.getByRole('combobox',{name:'Record to inspect',exact:true}).selectOption(value);await clean()}
 await set('Acquisition time constant','20e-9');await set('Slew rate','10e6');await clean()
 await page.screenshot({path:`${shots}/${live?'live-':''}d4-spectrum-${width}.png`,fullPage:true})
 await page.goto(`${base}/mixed-signal-lab/#d5`);await page.getByRole('button',{name:'Explore',exact:true}).click();await set('Measured sample count','1024');await set('Comparator offset standard deviation','1e0')
 const zero=density({count:1024,sigma:1}).rows.find(z=>z.hits===0);assert(zero)
 await set('Code to inspect',String(zero.code));assert(zero.ci[1]>-1);await clean()
 await page.getByRole('combobox',{name:'Input distribution',exact:true}).selectOption('1');assert(await page.getByText('all-boundary 95% DKW band',{exact:false}).isVisible());await clean()
 await page.screenshot({path:`${shots}/${live?'live-':''}d5-histogram-${width}.png`,fullPage:true})
 await page.getByRole('button',{name:'Reset settings',exact:true}).click();assert.equal(await page.getByRole('combobox',{name:'Input distribution',exact:true}).inputValue(),'0')
 assert.deepEqual(errors,[]);await page.close();console.log(`${live?'Live':'Assembled'} Mixed-Signal D1–D5 verified at ${width}px`)
}}finally{await browser.close();if(server)await new Promise(done=>server.close(done))}
