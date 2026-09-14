import assert from 'node:assert/strict'
import {chromium} from 'playwright'
import {mkdir} from 'node:fs/promises'
import {resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {serveSite} from './assemble-site.mjs'
const root=resolve(fileURLToPath(new URL('..',import.meta.url))),server=await serveSite({port:0,quiet:true}),base=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch({headless:true})
try{
 for(const width of [1440,390,320]){
  const page=await browser.newPage({viewport:{width,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message))
  for(const [app,id] of [['applied-analog-lab','b4'],['analog-ic-lab','b4'],['mixed-signal-lab','b4']]){
   await page.goto(`${base}/${app}/#${id}`);await page.getByRole('button',{name:'Worked math',exact:true}).click()
   const labels=await page.locator('.lesson-schematic>.schematic .sch-label').evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect();return{text:el.textContent,x:r.x,y:r.y,right:r.right,bottom:r.bottom}}))
   for(let i=0;i<labels.length;i++)for(let j=i+1;j<labels.length;j++){const a=labels[i],b=labels[j];assert(!(Math.min(a.right,b.right)>Math.max(a.x,b.x)+1&&Math.min(a.bottom,b.bottom)>Math.max(a.y,b.y)+1),`${app}: overlapping labels ${a.text}/${b.text}`)}
   await mkdir(resolve(root,`apps/${app}/.shots`),{recursive:true});await page.screenshot({path:resolve(root,`apps/${app}/.shots/group-b-${width}.png`),fullPage:true})
  }
  assert.equal(await page.getByRole('spinbutton',{name:'Sampling / feedback capacitance',exact:true}).inputValue(),'0.1','Dimensionless ratios use plain decimal values')
  await page.getByLabel('Displayed switch phase',{exact:true}).selectOption('0');assert(await page.locator('.lesson-schematic>figcaption').filter({hasText:'φ1 sample'}).isVisible())
  await page.getByLabel('Displayed switch phase',{exact:true}).selectOption('1');assert(await page.locator('.lesson-schematic>figcaption').filter({hasText:'φ2 transfer'}).isVisible())
  await page.getByLabel('Plate switching arrangement',{exact:true}).selectOption('1');assert(await page.locator('.lesson-schematic>figcaption').filter({hasText:'Left plate joins sum'}).isVisible())
  await page.getByLabel('Experiment',{exact:true}).selectOption('b3');await page.getByRole('button',{name:'Explore',exact:true}).click()
  const link=page.getByRole('link',{name:'Inspect the permitted continuous approximation',exact:true});assert(await link.isVisible())
  const cycle=page.getByRole('spinbutton',{name:'Samples per input cycle',exact:true});await cycle.fill('19');await cycle.press('Enter');assert.equal(await link.count(),0)
  await page.getByRole('button',{name:'Reset settings',exact:true}).click();assert(await link.isVisible())
  await page.getByLabel('Experiment',{exact:true}).selectOption('b5');await page.getByRole('button',{name:'Explore',exact:true}).click()
  const canvas=page.getByRole('img',{name:'Poles and zeros on the z-plane; the unit circle is the frequency axis',exact:true});await canvas.scrollIntoViewIfNeeded();const before=await canvas.screenshot()
  const q=page.getByRole('spinbutton',{name:'Target quality factor',exact:true});await q.fill('4');await q.press('Enter');await canvas.scrollIntoViewIfNeeded();assert(!before.equals(await canvas.screenshot()),'Z-plane must redraw when Q changes')
  const handover=page.getByRole('link',{name:'Inspect a time-scaled copy in Signal Lab',exact:true});const href=await handover.getAttribute('href');assert(href.includes('rate=192000')&&href.includes('src=sine:9600:0.1'))
  await handover.click();await page.waitForURL('**/signal-lab/**');assert.equal(await page.getByText(/sample rate .*ignored|outside .*clamped/).count(),0)
  assert.deepEqual(errors,[],`${width}px errors`);await page.close();console.log(`Analog Group B diagrams, phase changes, approximation guard, z-plane redraw and Signal handover passed at ${width}px`)
 }
}finally{await browser.close();server.close()}
