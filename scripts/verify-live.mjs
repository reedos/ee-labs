import assert from 'node:assert/strict'
import {chromium} from 'playwright'
import {LABS} from './assemble-site.mjs'
const totals=(process.argv.find(a=>a.startsWith('--counts='))?.slice(9)??'21,21,23').split(',').map(Number)
const base='https://reedos.github.io/ee-labs',foundation=process.argv.includes('--foundation'),browser=await chromium.launch({headless:true})
try{
 for(const lab of LABS){const response=await fetch(`${base}/${lab}/`);assert.equal(response.status,200,lab)}
 for(const width of [390,320]){
  const page=await browser.newPage({viewport:{width,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message))
  await page.goto(`${base}/signal-lab/`)
  const elements=page.getByRole('link',{name:'Elements',exact:true}).first();assert(await elements.isVisible(),'Live Signal mobile Elements link')
  const box=await elements.boundingBox();assert(box.y>=0&&box.y<844,'Mobile navigation is on screen')
  await elements.click();await page.waitForURL('**/circuit-elements-lab/**')
  for(const [lab,total] of ['applied-analog-lab','analog-ic-lab','mixed-signal-lab'].map((lab,i)=>[lab,totals[i]])){
   await page.goto(`${base}/${lab}/#${foundation?'a1':(process.argv.find(a=>a.startsWith('--lesson='))?.slice(9)??'c1')}`)
   assert.equal(await page.getByLabel('Experiment',{exact:true}).locator('option').count(),foundation?6:total,`${lab} published catalog`)
   await page.getByRole('button',{name:'Worked math',exact:true}).click();assert(await page.locator('.katex').count()>2)
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${lab} live mobile overflow`)
  }
  assert.deepEqual(errors,[]);await page.close();console.log(`Live rollout verified at ${width}px`)
 }
 console.log(`${LABS.length} live app routes returned 200`)
}finally{await browser.close()}
