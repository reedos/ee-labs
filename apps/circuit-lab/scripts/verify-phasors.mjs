import { chromium, firefox } from 'playwright'
import { mkdir } from 'node:fs/promises'
await mkdir('shots/phasors', { recursive: true })
const base = process.env.APP_URL || 'http://127.0.0.1:4190/'
const browserName = process.env.BROWSER || 'chromium'
if (!['chromium', 'firefox'].includes(browserName)) throw new Error(`Unsupported browser: ${browserName}`)
const b = await ({ chromium, firefox })[browserName].launch()
const page = await b.newPage()
const failures = []
page.on('pageerror', e => failures.push(e.message))
for (const width of [1440, 390]) {
  await page.setViewportSize({width,height:1000})
  for (const id of ['complex','series','nodal','power']) {
    await page.goto(`${base}#phasors=${id}`)
    await page.locator(`[aria-current=step][href='#phasors=${id}']`).waitFor()
    const bad = await page.evaluate(() => ({
      overflow: document.querySelector('.phasor-course').scrollWidth > innerWidth + 1,
      tex: document.querySelectorAll('.katex-error').length,
      clipped: [...document.querySelectorAll('.phasor-course p,.phasor-course h2,.phasor-course h3')].filter(e => e.scrollWidth > e.clientWidth + 2).length,
    }))
    if(bad.overflow || bad.tex || bad.clipped) failures.push({width,id,...bad})
    await page.getByRole('button',{name:'Reveal explanation',exact:true}).click()
    await page.getByRole('button',{name:'Hide explanation',exact:true}).waitFor()
    const field = page.getByRole('spinbutton',{name:'Source amplitude (V peak)',exact:true})
    await field.fill('10'); await field.press('Enter')
    if (await field.inputValue() !== '10') failures.push({width,id,field:'source amplitude failed'})
    await page.getByRole('button',{name:'Reset values',exact:true}).click()
    if(id==='nodal' && width===1440) {
      await page.locator('.phasor-circuit').scrollIntoViewIfNeeded()
      await page.screenshot({path:'shots/phasors/desktop.png'})
    }
    if(id==='complex' && width===390) {
      await page.locator('.phasor-circuit').scrollIntoViewIfNeeded()
      await page.screenshot({path:'shots/phasors/phone.png'})
    }
  }
  await page.locator('.phasor-course-link').click()
  await page.locator('.phasor-return').waitFor()
  await page.locator('.phasor-return').click()
  await page.locator('[data-role=phasor-course]').waitFor()
}
await page.goto(base + '#circuit=rlcSeries:200:0.02:1e-7&out=l')
await page.locator('.phasor-return').waitFor()
await b.close()
console.log(JSON.stringify({browser:browserName,viewports:2,lessons:4,failures}))
if(failures.length)process.exitCode=1
