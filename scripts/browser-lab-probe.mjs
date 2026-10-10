import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const CASES = {
 'comms-lab': {label:'Modulation index', value:'0.8'},
 'computer-lab': {label:'Adder width', value:'8'},
 'control-lab-ii': {label:'Time constant τ', value:'0.2', lesson:7},
 'devices-lab': {label:'Donors N_D', value:'20000000000'},
 'dsp-lab': {label:'Frequency', value:'8000'},
 'electronics-lab': {label:'Input V₁', value:'1'},
 'energy-lab': {label:'Irradiance', value:'700'},
 'grid-lab': {label:'Base power', value:'200'},
 'info-lab': {label:'Moved to the last', value:'0.2', view:'Curve'},
 'logic-lab': {label:'Inverter delay', value:'60'},
 'rf-lab': {label:'Load resistance', value:'150', view:'Chart'},
}
const PRESETS = '.preset, .picker li button, .sidebar .lesson-group button'
const VIEWS = '.view-switch button, .view-head [aria-label="Which view the pane shows"] button'
const settle = async page => { await page.evaluate(()=>document.fonts.ready); await page.waitForTimeout(120) }
async function expandPicker(page) {
 for (const selector of ['.controls button.group-head[aria-expanded="false"]', 'details.preset-group:not([open]) > summary, nav.picker details:not([open]) > summary']) {
  const closed=page.locator(selector)
  const count=await closed.count()
  for(let i=0;i<count;i++) await closed.first().click()
 }
}
async function choose(page, i) {
 await expandPicker(page)
 const row = page.locator(PRESETS).nth(i)
 const group = await row.evaluate(e=>e.closest('[role="tabpanel"]')?.getAttribute('aria-label'))
 if(group) {
  const tabs=page.locator('.group-tab')
  for(const tab of await tabs.all()) if((await tab.textContent()).trim()===group) {await tab.click();break}
 }
 await row.click(); await settle(page)
 assert(await row.evaluate(e=>e.classList.contains('is-on')||e.classList.contains('on')||e.getAttribute('aria-pressed')==='true'), 'Chosen lesson was not selected')
}
async function snapshot(page) {
 return page.evaluate(()=>{
  const visible=e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(e).visibility!=='hidden'}
  const canvases=[...document.querySelectorAll('canvas')].filter(visible).map(c=>{
   const ctx=c.getContext('2d');if(!ctx)return {hash:'webgl',ink:1,colours:3}
   const d=ctx.getImageData(0,0,c.width,c.height).data;let h=0,ink=0;const colours=new Set()
   for(let i=0;i<d.length;i+=16){h=(Math.imul(h,31)+d[i]+3*d[i+1]+7*d[i+2]+d[i+3])|0;if(d[i+3])ink++;colours.add(`${d[i]>>4},${d[i+1]>>4},${d[i+2]>>4}`)}
   return {hash:h,ink,colours:colours.size,width:c.width,height:c.height}
  })
  const svgs=[...document.querySelectorAll('main svg,.views svg,.panes svg')].filter(visible).map(s=>s.outerHTML)
  const readouts=[...document.querySelectorAll('.topbar-field,.flow-node.is-out,.flow-node[data-role],.readout,[data-role="headline"],[data-role="outcome"],.headline-value,.meters,.view table,.panes table')].filter(visible).map(e=>e.textContent.trim()).join('|')
  return {canvases,svgs,readouts,mainText:[...document.querySelectorAll('main,.views,.panes')].filter(visible).map(e=>e.innerText).join('|')}
 })
}
function checkPaint(s, label) {
 for(const c of s.canvases) assert(c.ink>0&&c.colours>=3&&c.width>0&&c.height>0,`${label}: canvas blank or collapsed ${JSON.stringify(c)}`)
 assert(s.canvases.length||s.svgs.length||s.mainText.trim().length>20,`${label}: no rendered plot, table, or explanation`)
 assert(!/\bNaN\b|\bundefined\b/.test(s.readouts),`${label}: invalid numeric readout`)
}
export async function verifyLab(lab) {
 assert(process.env.APP_URL, 'Set APP_URL to the built lab preview')
 const browser=await chromium.launch()
 const errors=[];const out=path.resolve(process.env.SHOTS_DIR||'shots')
 fs.mkdirSync(out,{recursive:true})
 try {
  const page=await browser.newPage({viewport:{width:1440,height:1000}})
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!/cloudflareinsights/.test(m.text()+(m.location().url||'')))errors.push(m.text())})
  if(process.env.VERIFY_BREAK_INPUT==='1') await page.addInitScript(()=>{for(const type of ['input','change','keydown'])document.addEventListener(type,e=>{if(e.target.matches('input'))e.stopImmediatePropagation()},true)})
  await page.goto(process.env.APP_URL);await page.waitForSelector('.app');await settle(page)
  const c=CASES[lab];assert(c,`No wiring case for ${lab}`)
  if(c.lesson!==undefined) await choose(page,c.lesson)
  if(c.view) await page.locator(VIEWS).filter({hasText:new RegExp(`^${c.view}$`)}).first().click()
  await settle(page)
  const field=page.getByLabel(c.label,{exact:true});const original=await field.inputValue()
  const before=await snapshot(page);checkPaint(before,`${lab} default`)
  await field.fill(c.value);await field.press('Enter');await settle(page)
  const after=await snapshot(page);checkPaint(after,`${lab} changed`)
  assert.notEqual(after.readouts,before.readouts,`${lab}: ${c.label} moved no derived readout`)
  assert.notEqual(JSON.stringify([after.canvases.map(c=>c.hash),after.svgs]),JSON.stringify([before.canvases.map(c=>c.hash),before.svgs]),`${lab}: ${c.label} did not update a plot or diagram`)
  if(lab==='comms-lab') assert.match(await page.locator('.topbar').innerText(),/index 0\.8\b/)
  await field.fill(original);await field.press('Enter');await settle(page)
  assert.equal((await snapshot(page)).readouts,before.readouts,`${lab}: restoring the knob did not restore the readout`)
  console.log(`${lab}: ${c.label} changes derived readouts and plot/diagram, then restores`)
  await expandPicker(page)
  const count=await page.locator(PRESETS).count();assert(count>=10,`${lab}: picker unexpectedly contains only ${count} lessons`)
  let views=0
  for(let i=0;i<count;i++) {
   await choose(page,i);checkPaint(await snapshot(page),`${lab} lesson ${i+1}`)
   const labels=await page.locator(VIEWS).evaluateAll(es=>es.map(e=>e.textContent.trim()))
   for(const label of [...new Set(labels)]) {
    await page.locator(VIEWS).filter({hasText:new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}$`)}).first().click()
    await settle(page);checkPaint(await snapshot(page),`${lab} lesson ${i+1} / ${label}`);views++
   }
   if(errors.length) throw new Error(`${lab}: ${errors.join('\n')}`)
  }
  await choose(page,0);await page.screenshot({path:path.join(out,`${lab}-desktop.png`)})
  assert.equal(errors.length,0,errors.join('\n'))
  console.log(`${lab}: PASS ${count} lessons, ${views} view selections, no browser errors`)
 } finally {await browser.close()}
}
