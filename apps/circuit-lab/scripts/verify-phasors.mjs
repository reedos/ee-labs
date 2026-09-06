import { chromium, firefox } from 'playwright'
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
const base = process.env.APP_URL || 'http://127.0.0.1:4192/circuit-lab/'
const browserName = process.env.BROWSER || 'chromium'
const browser = await ({chromium,firefox})[browserName].launch()
const context = await browser.newContext()
const page = await context.newPage()
const errors = []
page.on('pageerror', e => errors.push(e.message))
await mkdir('shots/consolidation', {recursive:true})
for (const width of [1440,390]) {
  await page.setViewportSize({width,height:1000})
  for (const [old,id,view] of [['complex','h2','phasor'],['series','h3','phasor'],['nodal','h8','phasor'],['power','h8','acpower']]) {
    await page.goto(`${base}#phasors=${old}`)
    await page.waitForURL(url => url.pathname.includes('circuit-elements-lab') && url.hash.startsWith(`#${id}`))
    await page.locator('.view-body').last().waitFor()
    assert.equal(await page.locator('.katex-error').count(),0)
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth > innerWidth+1),false)
    assert.equal(await page.getByRole('button',{name:'Circuits II',exact:true}).getAttribute('aria-pressed'),'true')
  }
  await page.goto(new URL('../circuit-elements-lab/#h8&v0=2&i0=0.01&view=state',base).href)
  await page.locator('[data-role="worked-state"]').waitFor()
  assert.equal(await page.locator('.katex-error').count(),0)
  await page.screenshot({path:`shots/consolidation/${browserName}-${width}.png`})
  await page.locator('.view-switch').getByRole('button',{name:'Equations',exact:true}).click()
  await page.locator('.equations').waitFor()
  if(width===1440) {
    const result=await page.evaluate(()=>{
      const body=document.querySelector('.view-body:not([data-show])');body.scrollTop=body.scrollHeight;
      return {scrolled:body.scrollTop>0,visible:body.clientHeight>300}
    })
    assert.ok(result.scrolled && result.visible)
  }
  await page.getByRole('button',{name:'Circuits I',exact:true}).click()
  assert.equal(await page.getByRole('button',{name:'Circuits I',exact:true}).getAttribute('aria-pressed'),'true')
}
await page.goto(base)
await page.locator('.phasor-return').waitFor()
assert.equal(await page.locator('[data-role="phasor-course"]').count(),0)
await page.goto(`${base}#circuit=rlcSeries:200:0.02:1e-7&out=l`)
await page.locator('.phasor-return').waitFor()
assert.ok(page.url().includes('rlcSeries:200:0.02:1e-7'))
assert.deepEqual(errors,[])
await browser.close()
console.log(`${browserName}: consolidated routes, math panes, initial conditions and desktop/phone layouts passed`)
