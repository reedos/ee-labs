import assert from 'node:assert/strict'
import {chromium} from 'playwright'
import {serveSite} from './assemble-site.mjs'
const server=await serveSite({port:0,quiet:true}),base=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch({headless:true})
try {for(const width of [1440,390,320]) {
 const page=await browser.newPage({viewport:{width,height:900}})
 for(const id of ['c1','c2']) {
  await page.goto(`${base}/applied-analog-lab/#${id}`)
  await page.getByRole('button',{name:'Worked math',exact:true}).click()
  const labels=await page.locator('.lesson-schematic>.schematic .sch-label').evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect();return{text:el.textContent,x:r.x,y:r.y,right:r.right,bottom:r.bottom}}))
  assert(labels.length>=5,'Drawing is present')
  for(let i=0;i<labels.length;i++)for(let j=i+1;j<labels.length;j++){const a=labels[i],b=labels[j];assert(!(Math.min(a.right,b.right)>Math.max(a.x,b.x)+1&&Math.min(a.bottom,b.bottom)>Math.max(a.y,b.y)+1),`Overlapping labels ${a.text}/${b.text}`)}
  await page.screenshot({path:`apps/applied-analog-lab/.shots/${id}-${width}.png`,fullPage:true})
 }
 await page.getByLabel('Experiment',{exact:true}).selectOption('c4')
 await page.getByRole('button',{name:'Explore',exact:true}).click()
 const corner=page.getByRole('spinbutton',{name:'Output low-pass corner',exact:true})
 await corner.fill('20000e0');await corner.press('Enter')
 assert(await page.getByText(/not accepted/).count()>0,'Approximation guard responds to settings')
 await page.close();console.log(`Precision drawings and approximation guard passed at ${width}px`)
}}finally{await browser.close();server.close()}

