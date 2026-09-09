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
 for(const [lab,total] of [['applied-analog-lab',45],['analog-ic-lab',45],['mixed-signal-lab',40]]){
  const {EXTENDED}=await import(`../apps/${lab}/src/extended.js`),shots=`apps/${lab}/.shots`;await mkdir(shots,{recursive:true})
  for(const lesson of EXTENDED.filter(l=>l.id.startsWith('g'))){
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
  console.log(`${live?'Live':'Assembled'} ${lab} Group G at ${width}px passed`)
 }
 await page.goto(`${base}/applied-analog-lab/#g1`);await set('Applied fault voltage',12.3);await page.getByRole('button',{name:'Explore',exact:true}).click();await clean()
 await page.goto(`${base}/applied-analog-lab/#g2`);await set('Applied input voltage',5.65);await page.getByRole('button',{name:'Explore',exact:true}).click();await clean()
 await page.goto(`${base}/applied-analog-lab/#g4`);await set('Cable length',5);await set('Buffer output resistance',200);await set('Buffer gain-bandwidth','20000000e0');await page.getByRole('button',{name:'Explore',exact:true}).click();assert(await page.getByText('The complete loop is unstable at these settings.',{exact:false}).isVisible());await clean()
 await page.getByRole('link',{name:'Inspect the complete shield loop in Control Lab',exact:true}).click();await page.waitForURL('**/control-lab/**');assert(!page.url().includes('undefined'));assert(await page.getByText('Driven-shield return ratio',{exact:false}).count());await page.screenshot({path:`apps/applied-analog-lab/.shots/${live?'live-':''}group-g4-control-${width}.png`,fullPage:true})
 for(const [lab,id,label,provenance] of [['analog-ic-lab','g3','Compare an ideal sine multiplier in Signal Lab','Linear sine-multiplier comparison'],['mixed-signal-lab','g5','Open the same difference filter in Signal Lab','Correlated double sampling']]){
  for(const delay of id==='g5'?[1,2]:[1]){await page.goto(`${base}/${lab}/#${id}`);if(id==='g5')await set('Sample separation',delay);await page.getByRole('button',{name:'Explore',exact:true}).click();await page.getByRole('link',{name:label,exact:true}).click();await page.waitForURL('**/signal-lab/**');assert(!page.url().includes('undefined'));assert(await page.getByText(provenance,{exact:false}).count());assert.equal(await page.locator('.katex-error').count(),0);await page.screenshot({path:`apps/${lab}/.shots/${live?'live-':''}group-${id}-signal-${delay}-${width}.png`,fullPage:true})}
 }
 assert.deepEqual(errors,[]);await page.close()
}}finally{await browser.close();if(server)await new Promise(done=>server.close(done))}
