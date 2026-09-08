import assert from 'node:assert/strict'
import {readFile,mkdir,stat,readdir} from 'node:fs/promises'
import {resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {chromium} from 'playwright'
import {serveSite,LABS} from './assemble-site.mjs'
const root=resolve(fileURLToPath(new URL('..',import.meta.url)))
const workflow=await readFile(resolve(root,'.github/workflows/deploy.yml'),'utf8')
const deployed=[...workflow.matchAll(/cp -r apps\/([^/]+)\/dist/g)].map(m=>m[1])
assert.deepEqual([...deployed].sort(),[...LABS].sort(),'Local assembly and deployment must contain the same apps')
const server=await serveSite({port:0,quiet:true}),base=`http://127.0.0.1:${server.address().port}`
const browser=await chromium.launch({headless:true})
try{
 for(const lab of LABS)assert.equal((await fetch(`${base}/${lab}/`)).status,200,lab)
 for(const width of [1440,390,320]){
  const page=await browser.newPage({viewport:{width,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message))
  for(const lab of ['applied-analog-lab','analog-ic-lab','mixed-signal-lab']){
   await page.goto(`${base}/${lab}/`)
   const nav=page.locator('.lesson-controls nav').first();assert(await nav.getByRole('link',{name:'Elements',exact:true}).isVisible(),`${lab}: mobile suite navigation`)
   assert.equal(await nav.getByRole('link',{name:'Elements',exact:true}).getAttribute('href'),`${base}/circuit-elements-lab/`)
  }
  await page.goto(`${base}/applied-analog-lab/#a1`)
  await page.getByLabel('Amplifier class',{exact:true}).selectOption('2')
  await page.getByRole('button',{name:'Worked math',exact:true}).click()
  assert(await page.getByText('JFET input gives the displayed linear bandwidth.',{exact:false}).isVisible())
  assert(await page.locator('.lesson-schematic .sch-label').first().evaluate(el=>getComputedStyle(el).fill!=='rgb(0, 0, 0)'))
  await page.getByLabel('Experiment',{exact:true}).selectOption('a2')
  await page.getByRole('button',{name:'Worked math',exact:true}).click()
  const labels=await page.locator('.lesson-schematic>.schematic .sch-label').evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect();return{text:el.textContent,x:r.x,y:r.y,right:r.right,bottom:r.bottom}}));for(let i=0;i<labels.length;i++)for(let j=i+1;j<labels.length;j++){const a=labels[i],b=labels[j];assert(!(Math.min(a.right,b.right)>Math.max(a.x,b.x)+1&&Math.min(a.bottom,b.bottom)>Math.max(a.y,b.y)+1),`Overlapping circuit labels: ${a.text} / ${b.text}`)}
  await mkdir(resolve(root,'apps/applied-analog-lab/.shots'),{recursive:true})
  await page.screenshot({path:resolve(root,`apps/applied-analog-lab/.shots/filter-${width}.png`),fullPage:true})
  await page.goto(`${base}/mixed-signal-lab/#a5`)
  await page.getByLabel('Switch phase',{exact:true}).selectOption('0');assert(await page.locator('.lesson-schematic>figcaption').filter({hasText:'Phase 0: both switches track'}).isVisible())
  await page.getByLabel('Switch phase',{exact:true}).selectOption('1');assert(await page.locator('.lesson-schematic>figcaption').filter({hasText:'ground switch opens first'}).isVisible())
  await page.getByLabel('Opening order',{exact:true}).selectOption('0');assert(await page.locator('.lesson-schematic>figcaption').filter({hasText:'input switch opens first'}).isVisible())
  await page.getByLabel('Opening order',{exact:true}).selectOption('1')
  await page.getByRole('button',{name:'Worked math',exact:true}).click()
  await page.screenshot({path:resolve(root,`apps/mixed-signal-lab/.shots/phases-${width}.png`),fullPage:true})
  await page.goto(`${base}/system-lab/#f3`)
  await page.getByText('IF amplifier settings',{exact:true}).click()
  const power=page.getByRole('spinbutton',{name:'IF amplifier DC power',exact:true});await power.fill('70');await power.press('Enter')
  const powerResult=page.locator('.lesson-results>div').filter({has:page.getByText('Power margin',{exact:true})});assert.match(await powerResult.innerText(),/2 mW/)
  await page.getByRole('button',{name:'Reset settings',exact:true}).click();assert.match(await powerResult.innerText(),/12 mW/)
  await page.getByLabel('Experiment',{exact:true}).selectOption('e2');await page.getByRole('button',{name:'Explore',exact:true}).click()
  assert(await page.getByRole('img',{name:/Link-budget waterfall/}).isVisible())
  await page.screenshot({path:resolve(root,`apps/system-lab/.shots/waterfall-${width}.png`),fullPage:true})
  await page.goto(`${base}/interfaces-lab/#f5`);await page.getByRole('button',{name:'Explore',exact:true}).click()
  const handover=page.getByRole('link',{name:'View the folded tone in Signal Lab',exact:true}),href=await handover.getAttribute('href')
  assert(href.includes('rate=10000')&&href.includes('src=sine:4000:1'))
  await handover.click();await page.waitForURL('**/signal-lab/**');assert(!await page.getByText(/frequency .*clamped/).count())
  assert.deepEqual(errors,[],`${width}px browser errors`)
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Signal handover overflow')
  await page.close();console.log(`Assembled rollout: navigation, editable models, drawing contrast, phases, waterfall and Signal handover passed at ${width}px`)
 }
 let bytes=0;async function size(dir){for(const item of await readdir(dir,{withFileTypes:true})){const p=resolve(dir,item.name);if(item.isDirectory())await size(p);else bytes+=(await stat(p)).size}}await size(resolve(root,'_site'))
 console.log(`Assembled site: ${LABS.length} apps, ${(bytes/1024/1024).toFixed(2)} MiB`)
}finally{await browser.close();server.close()}
