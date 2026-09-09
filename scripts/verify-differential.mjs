import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {chromium} from 'playwright'
import {serveSite} from './assemble-site.mjs'
const live=process.argv.includes('--live'),server=live?null:await serveSite({port:0,quiet:true})
const base=live?'https://reedos.github.io/ee-labs':`http://127.0.0.1:${server.address().port}`
const browser=await chromium.launch({headless:true}),shots='apps/analog-ic-lab/.shots'
await mkdir(shots,{recursive:true})
try{for(const width of [1440,390,320]){
 const page=await browser.newPage({viewport:{width,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message))
 const set=async(label,value)=>{const c=page.getByRole('spinbutton',{name:label,exact:true});await c.fill(value);await c.press('Enter')}
 const clean=async()=>{assert.equal(await page.getByRole('alert').count(),0);assert.equal(await page.locator('.katex-error').count(),0);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Page overflow')}
 for(const id of ['d1','d2','d3','d4']){
  await page.goto(`${base}/analog-ic-lab/#${id}`)
  assert.equal(await page.getByLabel('Experiment',{exact:true}).locator('option').count(),21)
  let geometry
  for(const view of ['Start here','Worked math','Explore','Practice']){
   await page.getByRole('button',{name:view,exact:true}).click();await clean()
   const next=await page.locator('.lesson-tabs button').evaluateAll(els=>els.map(e=>[e.offsetLeft,e.offsetTop,e.offsetWidth,e.offsetHeight]))
   geometry??=next;assert.deepEqual(next,geometry,`${id} anchored tabs`)
   if(view==='Worked math'){assert(await page.locator('.lesson-step .katex').count()>=4);await page.screenshot({path:`${shots}/${live?'live-':''}${id}-math-${width}.png`,fullPage:true})}
   if(view==='Explore'){
    assert.equal(await page.locator('.lesson-table-wrap tbody tr').evaluateAll(rows=>rows.some(row=>row.cells.length!==row.closest('table').tHead.rows[0].cells.length)),false,'Aligned column count')
    assert(!(await page.locator('.lesson-table-wrap').innerText()).includes('\\times'),'Plain number table')
   }
   if(view==='Practice'){await page.getByRole('button',{name:'Reveal answer',exact:true}).click();assert(await page.getByRole('button',{name:'Hide answer',exact:true}).isVisible())}
  }
 }
 await page.goto(`${base}/analog-ic-lab/#d1`);await page.getByRole('button',{name:'Explore',exact:true}).click()
 await set('Equal current error / branch current','.1');assert(await page.getByText('One device has entered triode.',{exact:false}).isVisible())
 await page.getByRole('combobox',{name:'Common-mode correction',exact:true}).selectOption('1');assert(await page.getByText('Both devices remain in saturation.',{exact:false}).isVisible());await clean()
 for(const id of ['d2','d3']){
  await page.goto(`${base}/analog-ic-lab/#${id}`)
  const labels=await page.locator('.lesson-schematic>.schematic .sch-label').evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect();return{text:el.textContent,x:r.x,y:r.y,right:r.right,bottom:r.bottom}}))
  assert(labels.length>=5,'Circuit labels rendered')
  for(let i=0;i<labels.length;i++)for(let j=i+1;j<labels.length;j++){const a=labels[i],b=labels[j];assert(!(Math.min(a.right,b.right)>Math.max(a.x,b.x)+1&&Math.min(a.bottom,b.bottom)>Math.max(a.y,b.y)+1),`Overlapping ${id} labels ${a.text}/${b.text}`)}
  await page.getByRole('button',{name:'Enlarge circuit',exact:true}).click();await page.getByRole('dialog').screenshot({path:`${shots}/${live?'live-':''}${id}-circuit-${width}.png`});await page.keyboard.press('Escape')
 }
 await page.goto(`${base}/analog-ic-lab/#d2`);await page.getByRole('button',{name:'Explore',exact:true}).click();await set('Tail resistance','1e4');assert(await page.getByText('The shortcut differs by more than 5%',{exact:false}).isVisible())
 for(const mode of ['common','differential']){
  await page.goto(`${base}/analog-ic-lab/#d3`);await page.getByRole('button',{name:'Explore',exact:true}).click()
  await set('Common-mode controller pole','1e6');await clean()
  assert.equal(await page.locator('.lesson-handover a').count(),2)
  await page.getByRole('link',{name:`Inspect the ${mode}-mode loop in Control Lab`,exact:true}).click();await page.waitForURL('**/control-lab/**')
  assert(await page.getByText(`${mode==='common'?'Common':'Differential'}-mode loop`,{exact:false}).count(),'Receiver identifies the selected mode')
  assert(!new URL(page.url()).hash.includes('undefined'))
 }
 await page.goto(`${base}/analog-ic-lab/#d4`)
 for(const sensor of ['0','1','2']){
  await page.getByRole('combobox',{name:'Sensor to inspect',exact:true}).selectOption(sensor)
  await page.getByRole('button',{name:'Worked math',exact:true}).click();await clean();assert(await page.locator('.lesson-step').count()>=4)
  await page.getByRole('button',{name:'Explore',exact:true}).click();await clean()
 }
 await set('Sampling frequency','20e6');await set('Each sampling or sensor capacitance','1e-12')
 assert(await page.getByText('Incomplete acquisition:',{exact:false}).isVisible());await clean()
 await page.screenshot({path:`${shots}/${live?'live-':''}d4-sampler-${width}.png`,fullPage:true})
 await page.getByRole('button',{name:'Reset settings',exact:true}).click();assert.equal(await page.getByRole('combobox',{name:'Sensor to inspect',exact:true}).inputValue(),'0')
 assert.deepEqual(errors,[]);await page.close();console.log(`${live?'Live':'Assembled'} Analog IC D1–D4 verified at ${width}px`)
}}finally{await browser.close();if(server)await new Promise(done=>server.close(done))}
