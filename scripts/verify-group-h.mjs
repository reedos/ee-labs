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
 for(const [lab,total] of [['applied-analog-lab',40],['analog-ic-lab',37]]){
  const {EXTENDED}=await import(`../apps/${lab}/src/extended.js`),shots=`apps/${lab}/.shots`;await mkdir(shots,{recursive:true})
  for(const lesson of EXTENDED.filter(l=>l.id.startsWith('h'))){
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
  console.log(`${live?'Live':'Assembled'} ${lab} Group H at ${width}px passed`)
 }
 await page.goto(`${base}/applied-analog-lab/#h1`);await page.getByRole('combobox',{name:'Initial capacitor state',exact:true}).selectOption('1');await page.getByRole('button',{name:'Explore',exact:true}).click();await clean()
 await page.goto(`${base}/applied-analog-lab/#h2`);await set('Initial capacitor / supply ratio',.3);await page.getByRole('button',{name:'Explore',exact:true}).click();await clean()
 await page.goto(`${base}/applied-analog-lab/#h5`);await page.getByRole('button',{name:'Explore',exact:true}).click();assert(await page.getByText('The selected point delivers at least 20 W',{exact:false}).isVisible());await set('Each device junction-to-enclosure resistance',20);assert(await page.getByText('The selected point misses at least one task condition',{exact:false}).isVisible());await clean()
 await page.goto(`${base}/analog-ic-lab/#h3`);await set('Common process half-range',.4);await set('Maximum tuning command',1.1);await page.getByRole('button',{name:'Explore',exact:true}).click();await clean()
 for(const id of ['h2','h4']){await page.goto(`${base}/analog-ic-lab/#${id}`);if(id==='h4'){await set('Varied component index',3);await set('Selected fractional component error',-.2)}await page.getByRole('button',{name:'Explore',exact:true}).click();await page.getByRole('link',{name:'Explore a time-scaled digital copy in Signal Lab',exact:true}).click();await page.waitForURL('**/signal-lab/**');assert(!page.url().includes('undefined'));assert(await page.getByText('Integrated filter: scaled bilinear copy',{exact:false}).count());assert.equal(await page.locator('.katex-error').count(),0);await page.screenshot({path:`apps/analog-ic-lab/.shots/${live?'live-':''}group-${id}-signal-${width}.png`,fullPage:true})}
 assert.deepEqual(errors,[]);await page.close()
}}finally{await browser.close();if(server)await new Promise(done=>server.close(done))}
