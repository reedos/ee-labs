import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {chromium} from 'playwright'
import {serveSite} from './assemble-site.mjs'
import {defaults,evaluate} from '../packages/lessons/src/model.js'
const live=process.argv.includes('--live'),server=live?null:await serveSite({port:0,quiet:true}),base=live?'https://reedos.github.io/ee-labs':`http://127.0.0.1:${server.address().port}`
const browser=await chromium.launch({headless:true})
try{for(const width of [1440,390,320]){
 const page=await browser.newPage({viewport:{width,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message))
 const set=async(label,value)=>{const el=page.getByRole('spinbutton',{name:label,exact:true}),units={'Follower gain-bandwidth product':'Hz','Input channel length':'m'};await el.fill(units[label]?`${value} ${units[label]}`:String(value));await el.press('Enter')}
 const clean=async()=>{assert.equal(await page.getByRole('alert').count(),0);assert.equal(await page.locator('.katex-error').count(),0);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert(!await page.locator('.lesson-plot path').evaluateAll(els=>els.some(e=>/NaN|Infinity/.test(e.getAttribute('d')??''))))}
 for(const [lab,total,count] of [['applied-analog-lab',45,5],['analog-ic-lab',41,4]]){
  const {EXTENDED}=await import(`../apps/${lab}/src/extended.js`),lessons=EXTENDED.filter(l=>l.id.startsWith('i')),shots=`apps/${lab}/.shots`;assert.equal(lessons.length,count);await mkdir(shots,{recursive:true})
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
  console.log(`${live?'Live':'Assembled'} ${lab}: ${count} Group I lessons at ${width}px passed`)
 }
 await page.goto(`${base}/applied-analog-lab/#i2`);await set('Part tolerance or three-sigma spread',.05);await set('Follower gain-bandwidth product',500000);await page.getByRole('button',{name:'Explore',exact:true}).click();assert.equal(await page.locator('.lesson-table-wrap tbody tr').count(),16);await clean()
 await page.goto(`${base}/applied-analog-lab/#i3`);await set('Number of simulated circuits',10000);await set('Part tolerance or three-sigma spread',.05);await page.getByRole('button',{name:'Explore',exact:true}).click();assert(await page.getByText('The sample linearization residual exceeds 1%',{exact:false}).isVisible());await clean()
 await page.goto(`${base}/applied-analog-lab/#i4`);await set('Part tolerance or three-sigma spread',.001);await set('Allowed fractional natural-frequency error',.03);await set('Allowed fractional Q error',.03);await page.getByRole('button',{name:'Explore',exact:true}).click();const cells=await page.locator('.lesson-table-wrap tbody tr').last().locator('td').allTextContents();assert.equal(cells[3],'100');assert(cells[4].includes(' to 100'));assert.notEqual(cells[4],'100 to 100');await clean()
 await page.goto(`${base}/analog-ic-lab/#i3`);await set('Device width',40);await set('Device length',2);await page.getByRole('button',{name:'Explore',exact:true}).click();await clean()
 await page.goto(`${base}/analog-ic-lab/#i4`);await set('Input transconductance efficiency',10);await page.getByRole('button',{name:'Explore',exact:true}).click();assert(await page.getByText('Miss',{exact:true}).isVisible());await set('Input channel length',5e-6);assert(await page.getByText('Pass',{exact:true}).isVisible());await clean()
 assert.deepEqual(errors,[]);console.log(`${live?'Live':'Assembled'} Group I boundary, zero-failure interval and design checks at ${width}px passed`);await page.close()
}}finally{await browser.close();if(server)await new Promise(done=>server.close(done))}
