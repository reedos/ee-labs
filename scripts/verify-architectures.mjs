import assert from 'node:assert/strict'
import {chromium} from 'playwright'
import {serveSite} from './assemble-site.mjs'
const server=await serveSite({port:0,quiet:true}),base=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch({headless:true})
try {for(const width of [1440,390,320]) {
 const page=await browser.newPage({viewport:{width,height:900}})
 for(const id of ['c3']) {
  await page.goto(`${base}/analog-ic-lab/#${id}`)
  await page.getByRole('button',{name:'Worked math',exact:true}).click()
  const labels=await page.locator('.lesson-schematic>.schematic .sch-label').evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect();return{text:el.textContent,x:r.x,y:r.y,right:r.right,bottom:r.bottom}}))
  assert(labels.length>=5,'Drawing is present')
  for(let i=0;i<labels.length;i++)for(let j=i+1;j<labels.length;j++){const a=labels[i],b=labels[j];assert(!(Math.min(a.right,b.right)>Math.max(a.x,b.x)+1&&Math.min(a.bottom,b.bottom)>Math.max(a.y,b.y)+1),`Overlapping labels ${a.text}/${b.text}`)}
  await page.screenshot({path:`apps/analog-ic-lab/.shots/${id}-${width}.png`,fullPage:true})
 }
 await page.getByLabel('Experiment',{exact:true}).selectOption('c6')
 await page.getByRole('button',{name:'Explore',exact:true}).click()
 const control=page.getByLabel('Tail-current control',{exact:true})
 await control.selectOption('1')
 assert(await page.getByText('Ideal bias control',{exact:true}).count()>0)
 const common=page.getByRole('spinbutton',{name:'Input common-mode voltage',exact:true})
 await common.fill('0e0');await common.press('Enter')
 assert(await page.getByRole('cell',{name:'cutoff',exact:true}).count()>0,'Input pair turns off near a rail')
 await page.close();console.log(`Architecture drawing and input-pair handover passed at ${width}px`)
}}finally{await browser.close();server.close()}

