import {chromium,firefox} from 'playwright'
import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
const base=process.env.APP_URL||'http://127.0.0.1:4192/circuit-elements-lab/'
const name=process.env.BROWSER||'chromium'
const browser=await ({chromium,firefox})[name].launch()
const page=await browser.newPage()
const errors=[];page.on('pageerror',e=>errors.push(e.message))
await mkdir('shots/foundations',{recursive:true})
for(const width of [1440,390]) {
 await page.setViewportSize({width,height:1000})
 for(const [id,next] of [['f1','State equation'],['g1','State equation'],['h1','Phasors']]) {
  await page.goto(`${base}#${id}`)
  await page.locator('[data-role=foundations]').waitFor()
  assert.equal(await page.locator('[data-role=foundation-intro]').count(),1)
  assert.equal(await page.locator('[data-role=try]').count(),0)
  assert.equal(await page.locator('[data-role=solution-routes]').count(),0)
  assert.equal(await page.locator('.katex-error').count(),0)
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false)
  assert.equal(await page.locator('.foundations-pane p,.foundations-pane h3,.foundations-pane h4').evaluateAll(es=>es.filter(e=>e.scrollWidth>e.clientWidth+2).length),0)
  await page.screenshot({path:`shots/foundations/${name}-${id}-${width}.png`})
  await page.getByRole('button',{name:`Continue to ${next}`,exact:true}).click()
  await page.locator(`[data-role="${next==='Phasors'?'worked-phasor':'worked-state'}"]`).waitFor()
  if(width===1440) assert.equal(await page.locator('.view-body').last().evaluate(e=>e.scrollTop),0)
  assert.equal(await page.locator('.foundation-link').count(),1)
  await page.locator('.view-switch').getByRole('button',{name:'Start here',exact:true}).click()
  await page.locator('[data-role=foundations]').waitFor()
 }
 // Existing deep links still go straight to the requested analysis, with a visible prerequisite link.
 await page.goto(`${base}#h8&view=state&v0=2`)
 await page.locator('[data-role=worked-state]').waitFor()
 assert.ok((await page.locator('.foundation-link a').getAttribute('href')).startsWith('#g1'))
}
assert.deepEqual(errors,[])
await browser.close()
console.log(`${name}: foundations precede analysis; rendering, navigation and desktop/phone layouts passed`)
