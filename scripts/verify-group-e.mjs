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
 for(const [lab,total] of [['applied-analog-lab',35],['analog-ic-lab',33],['mixed-signal-lab',40]]){
  const {EXTENDED}=await import(`../apps/${lab}/src/extended.js`),shots=`apps/${lab}/.shots`;await mkdir(shots,{recursive:true})
  for(const lesson of EXTENDED.filter(l=>l.id.startsWith('e'))){
   await page.goto(`${base}/${lab}/#${lesson.id}`);assert.equal(await page.getByLabel('Experiment',{exact:true}).locator('option').count(),total)
   let anchor
   for(const view of ['Start here','Worked math','Explore','Practice']){
    await page.getByRole('button',{name:view,exact:true}).click();await clean()
    const next=await page.locator('.lesson-tabs button').evaluateAll(els=>els.map(e=>[e.offsetLeft,e.offsetTop,e.offsetWidth,e.offsetHeight]));anchor??=next;assert.deepEqual(next,anchor)
    if(view==='Worked math'){assert(await page.locator('.lesson-step').count()>=4);await page.screenshot({path:`${shots}/${live?'live-':''}group-${lesson.id}-math-${width}.png`,fullPage:true})}
    if(view==='Explore'){
     assert(!await page.locator('.lesson-table-wrap tr').evaluateAll(rows=>rows.some(row=>row.cells.length!==row.closest('table').tHead.rows[0].cells.length)))
     assert(!(await page.locator('.lesson-table-wrap').innerText()).includes('\\times'))
     await page.screenshot({path:`${shots}/${live?'live-':''}group-${lesson.id}-explore-${width}.png`,fullPage:true})
    }
    if(view==='Practice'){await page.locator('.lesson-practice input').fill(String(evaluate(lesson,defaults(lesson)).practice.answer));await page.getByRole('button',{name:'Check answer',exact:true}).click();assert(await page.getByRole('status').filter({hasText:'Correct within 2%'}).isVisible())}
   }
  }
  console.log(`${live?'Live':'Assembled'} ${lab} Group E at ${width}px passed`)
 }
 await page.goto(`${base}/applied-analog-lab/#e2`);await page.getByRole('button',{name:'Explore',exact:true}).click();await page.getByRole('combobox',{name:'Sense connection',exact:true}).selectOption('0');await clean();assert((await page.locator('.lesson-results').innerText()).includes('1.1'))
 await page.goto(`${base}/applied-analog-lab/#e5`);await set('Filter order',4);await page.getByRole('button',{name:'Explore',exact:true}).click();assert(await page.getByText('No corner can meet both requirements',{exact:false}).isVisible());await set('Filter order',5);await clean()
 await page.goto(`${base}/analog-ic-lab/#e2`);await page.getByRole('button',{name:'Worked math',exact:true}).click();assert(await page.getByText('no finite zero',{exact:false}).count());await set('Nulling resistance','6000e0');await clean()
 await page.getByRole('button',{name:'Enlarge circuit',exact:true}).click();await page.getByRole('dialog').screenshot({path:`apps/analog-ic-lab/.shots/${live?'live-':''}group-e2-circuit-${width}.png`});await page.keyboard.press('Escape')
 for(const id of ['e1','e3']){await page.goto(`${base}/analog-ic-lab/#${id}`);await page.getByRole('button',{name:'Explore',exact:true}).click();await page.getByRole('link',{name:'Inspect this exact loop in Control Lab',exact:true}).click();await page.waitForURL('**/control-lab/**');assert(await page.getByText('Miller compensation loop',{exact:false}).count());assert(!page.url().includes('undefined'))}
 await page.goto(`${base}/analog-ic-lab/#e4`);await page.getByRole('button',{name:'Enlarge circuit',exact:true}).click();await page.getByRole('dialog').screenshot({path:`apps/analog-ic-lab/.shots/${live?'live-':''}group-e4-nested-circuit-${width}.png`});await page.keyboard.press('Escape');await page.getByRole('combobox',{name:'Compensation scheme',exact:true}).selectOption('1');await page.getByRole('button',{name:'Worked math',exact:true}).click();assert(await page.getByText('no inner unity crossing',{exact:false}).count());await clean()
 await page.goto(`${base}/mixed-signal-lab/#e1`);await page.getByRole('combobox',{name:'Input record',exact:true}).selectOption('1');await clean()
 await page.goto(`${base}/mixed-signal-lab/#e5`);await set('Input magnitude','1.1e0');await page.getByRole('button',{name:'Explore',exact:true}).click();assert(await page.getByText('The state limit was crossed',{exact:false}).isVisible());await set('Input magnitude','.8e0');assert(await page.getByText('No guard crossing occurred',{exact:false}).isVisible());await clean()
 await page.goto(`${base}/mixed-signal-lab/#e6`);await page.getByRole('combobox',{name:'Droop correction',exact:true}).selectOption('0');await set('Decimation ratio',8);await set('Passband edge / output rate',.45);await page.getByRole('button',{name:'Explore',exact:true}).click();await clean();await page.getByRole('button',{name:'Reset settings',exact:true}).click();assert.equal(await page.getByRole('combobox',{name:'Droop correction',exact:true}).inputValue(),'1')
 assert.deepEqual(errors,[]);await page.close()
}}finally{await browser.close();if(server)await new Promise(done=>server.close(done))}
