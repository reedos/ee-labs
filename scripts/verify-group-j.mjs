import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {chromium} from 'playwright'
import {serveSite} from './assemble-site.mjs'
import {defaults,evaluate} from '../packages/lessons/src/model.js'
const live=process.argv.includes('--live'),server=live?null:await serveSite({port:0,quiet:true}),base=live?'https://reedos.github.io/ee-labs':`http://127.0.0.1:${server.address().port}`
const browser=await chromium.launch({headless:true})
try{for(const width of [1440,390,320]){
 const page=await browser.newPage({viewport:{width,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message))
 const set=async(label,value)=>{const el=page.getByRole('spinbutton',{name:label,exact:true}),units={'Stage transconductance':'S','Drain load resistance':'Ω','Source driving resistance':'Ω','Nominal bipolar trim half-range':'V','Untrimmed offset drift':'V/K','Actual offset at calibration temperature':'V'};await el.fill(units[label]?`${value} ${units[label]}`:String(value));await el.press('Enter')}
 const clean=async()=>{assert.equal(await page.getByRole('alert').count(),0);assert.equal(await page.locator('.katex-error').count(),0);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert(!await page.locator('.lesson-plot path').evaluateAll(els=>els.some(e=>/NaN|Infinity/.test(e.getAttribute('d')??''))))}
 for(const [lab,total,count] of [['analog-ic-lab',45,4]]){
  const {EXTENDED}=await import(`../apps/${lab}/src/extended.js`),lessons=EXTENDED.filter(l=>l.id.startsWith('j')),shots=`apps/${lab}/.shots`;assert.equal(lessons.length,count);await mkdir(shots,{recursive:true})
  for(const lesson of lessons){
   await page.goto(`${base}/${lab}/#${lesson.id}`);assert.equal(await page.getByLabel('Experiment',{exact:true}).locator('option').count(),total)
   let anchor
   for(const view of ['Start here','Worked math','Explore','Practice']){
    await page.getByRole('button',{name:view,exact:true}).click();await clean()
    const next=await page.locator('.lesson-tabs button').evaluateAll(els=>els.map(e=>[e.offsetLeft,e.offsetTop,e.offsetWidth,e.offsetHeight]));anchor??=next;assert.deepEqual(next,anchor)
    if(view==='Start here'&&await page.getByRole('button',{name:'Enlarge circuit',exact:true}).count()){await page.getByRole('button',{name:'Enlarge circuit',exact:true}).click();await page.getByRole('dialog').screenshot({path:`${shots}/${live?'live-':''}group-${lesson.id}-circuit-${width}.png`});await page.keyboard.press('Escape')}
    if(view==='Worked math'){assert(await page.locator('.lesson-step').count()>=5);await page.screenshot({path:`${shots}/${live?'live-':''}group-${lesson.id}-math-${width}.png`,fullPage:true})}
    if(view==='Explore'){assert(await page.getByRole('region',{name:'Scrollable results table'}).count()>0);if(width<760)assert(await page.locator('.lesson-table-hint').isVisible());assert(!await page.locator('.lesson-table-wrap tr').evaluateAll(rows=>rows.some(row=>row.cells.length!==row.closest('table').tHead.rows[0].cells.length)));assert(!(await page.locator('.lesson-table-wrap').innerText()).includes('\\times'));await page.screenshot({path:`${shots}/${live?'live-':''}group-${lesson.id}-explore-${width}.png`,fullPage:true})}
    if(view==='Practice'){await page.locator('.lesson-practice input').fill(String(evaluate(lesson,defaults(lesson)).practice.answer));await page.getByRole('button',{name:'Check answer',exact:true}).click();assert(await page.getByRole('status').filter({hasText:'Correct within 2%'}).isVisible())}
   }
  }
  console.log(`${live?'Live':'Assembled'} ${lab}: ${count} Group J lessons at ${width}px passed`)
 }
 await page.goto(`${base}/analog-ic-lab/#j2`);await page.getByRole('button',{name:'Explore',exact:true}).click();assert(await page.getByText('The pole estimate exceeds the 10% check',{exact:false}).isVisible());await set('Source driving resistance',50000);assert(await page.getByText('The pole estimate is within the 10% check',{exact:false}).isVisible());await clean()
 await set('Stage transconductance',100e-6);await set('Drain load resistance',5000);await set('Source driving resistance',2000);assert(await page.getByText('No finite crossing',{exact:true}).isVisible());await clean()
 await page.goto(`${base}/analog-ic-lab/#j3`);await set('Each input-device area',100);await set('Stored trim resolution',3);await set('Nominal bipolar trim half-range',.016);await page.getByRole('button',{name:'Explore',exact:true}).click();assert(await page.getByText('The uniform in-range RMS estimate misses the 5% check',{exact:false}).isVisible());await clean()
 await page.goto(`${base}/analog-ic-lab/#j4`);await page.getByRole('button',{name:'Explore',exact:true}).click();assert(await page.getByText('The ±500 µV temperature-interval task passes.',{exact:false}).isVisible());await set('Untrimmed offset drift',20e-6);assert(await page.getByText('The ±500 µV temperature-interval task fails.',{exact:false}).isVisible());await set('Actual offset at calibration temperature',.012);assert(await page.getByText('The measured offset is outside the nominal trim range.',{exact:false}).isVisible());await clean()
 await page.getByRole('link',{name:'Open Mixed-Signal C6: stored capacitor-weight calibration',exact:true}).click();await page.waitForURL('**/mixed-signal-lab/#c6');assert.equal(await page.getByLabel('Experiment',{exact:true}).inputValue(),'c6');assert.equal(await page.getByLabel('Experiment',{exact:true}).locator('option').count(),40);await page.getByRole('button',{name:'Worked math',exact:true}).click();await clean();assert(await page.locator('.lesson-step').count()>3)
 assert.deepEqual(errors,[]);console.log(`${live?'Live':'Assembled'} Group J approximation, range, drift and related-lesson checks at ${width}px passed`);await page.close()
}}finally{await browser.close();if(server)await new Promise(done=>server.close(done))}
