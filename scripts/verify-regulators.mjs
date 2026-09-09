import assert from 'node:assert/strict'
import {chromium} from 'playwright'
import {serveSite} from './assemble-site.mjs'
const server=await serveSite({port:0,quiet:true}),base=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch({headless:true})
try{for(const width of [1440,390,320]){
 const page=await browser.newPage({viewport:{width,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message))
 const set=async(label,value)=>{const c=page.getByRole('spinbutton',{name:label,exact:true});await c.fill(value);await c.press('Enter')}
 await page.goto(`${base}/applied-analog-lab/#d2`)
 await page.getByRole('button',{name:'Worked math',exact:true}).click()
 const labels=await page.locator('.lesson-schematic>.schematic .sch-label').evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect();return{text:el.textContent,x:r.x,y:r.y,right:r.right,bottom:r.bottom}}))
 assert(labels.length>=7,'LDO circuit labels present')
 for(let i=0;i<labels.length;i++)for(let j=i+1;j<labels.length;j++){const a=labels[i],b=labels[j];assert(!(Math.min(a.right,b.right)>Math.max(a.x,b.x)+1&&Math.min(a.bottom,b.bottom)>Math.max(a.y,b.y)+1),`Overlapping LDO labels ${a.text}/${b.text}`)}
 await page.screenshot({path:`apps/applied-analog-lab/.shots/d2-${width}.png`,fullPage:true})
 await page.getByRole('button',{name:'Enlarge circuit',exact:true}).click()
 await page.getByRole('dialog').screenshot({path:`apps/applied-analog-lab/.shots/d2-circuit-${width}.png`});await page.keyboard.press('Escape')
 await set('Capacitor ESR','0e0');assert(await page.getByText('No finite ESR zero',{exact:false}).count())
 await page.getByRole('button',{name:'Explore',exact:true}).click()
 const link=page.getByRole('link',{name:'Inspect this LDO loop in Control Lab'});await link.click();await page.waitForURL('**/control-lab/**');assert(await page.getByText('LDO return ratio',{exact:false}).count())
 await page.goto(`${base}/applied-analog-lab/#d3`);await page.getByRole('button',{name:'Explore',exact:true}).click()
 await page.getByText('Additional supply paths settings',{exact:true}).click();await set('Reference supply coupling','0.001');assert.equal(await page.getByRole('alert').count(),0)
 const rows=await page.locator('.lesson-table-wrap tr').allTextContents();assert(rows.some(x=>x.includes('Reference')));assert(!rows.some(x=>x.includes('\\times')))
 await page.goto(`${base}/applied-analog-lab/#d4`);await page.getByRole('button',{name:'Explore',exact:true}).click();await set('Input voltage','3.3e0');assert(await page.getByText('Headroom is insufficient.',{exact:false}).isVisible())
 await page.goto(`${base}/applied-analog-lab/#d5`);await page.getByRole('button',{name:'Explore',exact:true}).click()
 assert(await page.getByText('The linear candidate passes',{exact:false}).isVisible())
 await page.getByText('Noise and ripple assumptions settings',{exact:true}).click();await set('Buck white-noise density','1e-7')
 assert.equal(await page.getByRole('spinbutton',{name:'Buck white-noise density',exact:true}).getAttribute('aria-valuenow'),'1e-7','Scientific entry retains base units')
 await set('Buck white-noise density','500n');await set('Buck white-noise density','100')
 assert(Math.abs(Number(await page.getByRole('spinbutton',{name:'Buck white-noise density',exact:true}).getAttribute('aria-valuenow'))-1e-7)<1e-18,'Bare entry uses displayed nanovolts')
 assert(await page.getByText('The buck meets the assumed in-band signal budget',{exact:false}).isVisible())
 await page.screenshot({path:`apps/applied-analog-lab/.shots/d5-${width}.png`,fullPage:true})
 await page.getByRole('link',{name:'Explore this operating point as an ideal buck',exact:true}).click();await page.waitForURL('**/power-lab/**')
 assert(await page.getByRole('status').filter({hasText:'Imported ideal buck operating point'}).isVisible())
 assert(await page.getByText('The note describes the default settings.',{exact:false}).isVisible())
 assert.equal(await page.locator('[data-knob="Vin"] input[role="spinbutton"]').inputValue(),'5')
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Power handover has no page overflow')
 await page.goto(`${base}/power-lab/#b=buck:12:0.275:0.0001:0.0001:3.3:-1`);await page.reload()
 assert(await page.getByRole('alert').isVisible(),'Invalid switching frequency is refused')
 assert.deepEqual(errors,[]);await page.close();console.log(`Regulator drawings, boundaries and cross-lab handovers passed at ${width}px`)
}}finally{await browser.close();server.close()}
