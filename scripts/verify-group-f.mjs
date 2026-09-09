import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {chromium} from 'playwright'
import {serveSite} from './assemble-site.mjs'
import {defaults,evaluate} from '../packages/lessons/src/model.js'
const live=process.argv.includes('--live'),server=live?null:await serveSite({port:0,quiet:true}),base=live?'https://reedos.github.io/ee-labs':`http://127.0.0.1:${server.address().port}`
const browser=await chromium.launch({headless:true})
try {for(const width of [1440,390,320]){
 const page=await browser.newPage({viewport:{width,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message))
 const set=async(label,value)=>{const el=page.getByRole('spinbutton',{name:label,exact:true});await el.fill(String(value));await el.press('Enter')}
 const clean=async()=>{assert.equal(await page.getByRole('alert').count(),0);assert.equal(await page.locator('.katex-error').count(),0);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert(!await page.locator('.lesson-plot path').evaluateAll(els=>els.some(e=>/NaN|Infinity/.test(e.getAttribute('d')??''))))}
 for(const [lab,total] of [['applied-analog-lab',31],['analog-ic-lab',29],['mixed-signal-lab',35]]){
  const {EXTENDED}=await import(`../apps/${lab}/src/extended.js`),shots=`apps/${lab}/.shots`;await mkdir(shots,{recursive:true})
  for(const lesson of EXTENDED.filter(l=>l.id.startsWith('f'))){
   await page.goto(`${base}/${lab}/#${lesson.id}`);assert.equal(await page.getByLabel('Experiment',{exact:true}).locator('option').count(),total)
   let anchor
   for(const view of ['Start here','Worked math','Explore','Practice']){
    await page.getByRole('button',{name:view,exact:true}).click();await clean()
    const next=await page.locator('.lesson-tabs button').evaluateAll(els=>els.map(e=>[e.offsetLeft,e.offsetTop,e.offsetWidth,e.offsetHeight]));anchor??=next;assert.deepEqual(next,anchor)
    if(view==='Start here'&&await page.getByRole('button',{name:'Enlarge circuit',exact:true}).count()){
      await page.getByRole('button',{name:'Enlarge circuit',exact:true}).click();await page.getByRole('dialog').screenshot({path:`${shots}/${live?'live-':''}group-${lesson.id}-circuit-${width}.png`});await page.keyboard.press('Escape')
    }
    if(view==='Worked math'){assert(await page.locator('.lesson-step').count()>=4);await page.screenshot({path:`${shots}/${live?'live-':''}group-${lesson.id}-math-${width}.png`,fullPage:true})}
    if(view==='Explore'){
     assert(!await page.locator('.lesson-table-wrap tr').evaluateAll(rows=>rows.some(row=>row.cells.length!==row.closest('table').tHead.rows[0].cells.length)))
     assert(!(await page.locator('.lesson-table-wrap').innerText()).includes('\\times'))
     await page.screenshot({path:`${shots}/${live?'live-':''}group-${lesson.id}-explore-${width}.png`,fullPage:true})
    }
    if(view==='Practice'){await page.locator('.lesson-practice input').fill(String(evaluate(lesson,defaults(lesson)).practice.answer));await page.getByRole('button',{name:'Check answer',exact:true}).click();assert(await page.getByRole('status').filter({hasText:'Correct within 2%'}).isVisible())}
   }
  }
  console.log(`${live?'Live':'Assembled'} ${lab} Group F at ${width}px passed`)
 }
 await page.goto(`${base}/applied-analog-lab/#f5`);await page.getByRole('button',{name:'Explore',exact:true}).click();assert(await page.getByText('The selected cascade misses the sampled mask.',{exact:false}).isVisible());await set('Cascade corner adjustment',1.1);await set('Cascade Q multiplier',.95);assert(await page.getByText('The selected cascade passes the sampled mask.',{exact:false}).isVisible());await clean()
 await page.getByRole('combobox',{name:'Cascade topology',exact:true}).selectOption('1');await set('Cascade corner adjustment',1.2);await page.getByRole('button',{name:'Enlarge circuit',exact:true}).click();await page.getByRole('dialog').screenshot({path:`apps/applied-analog-lab/.shots/${live?'live-':''}group-f5-mfb-circuit-${width}.png`});await page.keyboard.press('Escape');assert(await page.getByText('The selected cascade passes the sampled mask.',{exact:false}).isVisible());await clean()
 await page.goto(`${base}/analog-ic-lab/#f3`);await page.getByRole('button',{name:'Explore',exact:true}).click();await page.getByRole('combobox',{name:'Previous output state',exact:true}).selectOption('1');assert((await page.locator('.lesson-results').innerText()).includes('-0.5'));await clean()
 await page.goto(`${base}/mixed-signal-lab/#f1`);await set('Phase difference on one cycle branch',7);await page.getByRole('button',{name:'Explore',exact:true}).click();assert(await page.getByText('No pulse waveform or claimed average is provided',{exact:false}).isVisible());await clean()
 await page.goto(`${base}/mixed-signal-lab/#f4`);await set('Reference-frequency step','1000000e0');await page.getByRole('button',{name:'Explore',exact:true}).click();assert(await page.getByText('The linear prediction exceeds',{exact:false}).isVisible());await clean()
 for(const extra of [0,.1]){await page.goto(`${base}/mixed-signal-lab/#f3`);await set('Shunt capacitance / main capacitance',extra);await page.getByRole('button',{name:'Explore',exact:true}).click();await page.getByRole('link',{name:'Inspect this exact PLL loop in Control Lab',exact:true}).click();await page.waitForURL('**/control-lab/**');assert(await page.getByText('Charge-pump PLL return ratio',{exact:false}).count());assert.equal(await page.locator('.katex-error').count(),0);assert(!page.url().includes('undefined'));await page.screenshot({path:`apps/mixed-signal-lab/.shots/${live?'live-':''}group-f3-control-${extra}-${width}.png`,fullPage:true})}
 assert.deepEqual(errors,[]);await page.close()
}}finally{await browser.close();if(server)await new Promise(done=>server.close(done))}
