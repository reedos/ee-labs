import {chromium,firefox} from 'playwright'
import assert from 'node:assert/strict'
const base=process.env.APP_URL||'http://127.0.0.1:4192/circuit-elements-lab/'
const browser=await ({chromium,firefox})[process.env.BROWSER||'chromium'].launch()
const page=await browser.newPage()
const errors=[]
page.on('pageerror',e=>errors.push(e.message))
const go=async(id,rest='')=>{await page.goto(`${base}#${id}${rest}`);await page.locator(`.app[data-experiment="${id}"] .analysis-head`).waitFor()}
try{
  for(const width of [1440,390]){
    await page.setViewportSize({width,height:1000})
    await go('n1')
    const ids=await page.locator('#picker-list .presets button[title]').evaluateAll(bs=>bs.map(b=>b.title.match(/^([A-Z]\d+) ·/)[1].toLowerCase()))
    const additions=ids.filter(id=>/^(d(?:7|8|9|10)|e10|f[89]|g8|h(?:9|10|11)|[j-n]\d+)$/.test(id))
    assert.equal(additions.length,30)
    for(const id of additions){
      await go(id)
      assert.equal(await page.locator('.katex-error').count(),0,`${id}: valid rendered math`)
      assert.ok(await page.locator('[data-role="worked-method"] .worked-step').count()>0 || await page.locator('[data-role="method-derivation"]').count()>0,`${id}: worked steps`)
      assert.ok(await page.locator('.method-practice input').count()>0,`${id}: independent practice`)
      const text=await page.locator('[data-role="worked-method"]').innerText()
      assert.ok(!/NaN|undefined/.test(text),`${id}: finite displayed results`)
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`${id}: page width`)
    }
    await go('n1')
    const practice=page.locator('.method-practice').first(),answer=practice.locator('input'),status=practice.locator('[role="status"]')
    await answer.fill('abc');await practice.getByRole('button',{name:'Check answer'}).click();assert.match(await status.innerText(),/Enter a number/)
    await answer.fill('0');await practice.getByRole('button',{name:'Check answer'}).click();assert.match(await status.innerText(),/Not yet/)
    await practice.getByRole('button',{name:'Hint',exact:true}).click();assert.equal(await practice.getByRole('button',{name:'Hint',exact:true}).getAttribute('aria-expanded'),'true')
    await answer.fill('1.103638e0');await practice.getByRole('button',{name:'Check answer'}).click();assert.match(await status.innerText(),/Correct/)
    await go('n1','&v0=6');assert.equal(await page.locator('.method-practice input').first().inputValue(),'')
    await go('h10');await page.getByRole('button',{name:'Apply the matched load'}).click();assert.match(page.url(),/R2=/);assert.match(page.url(),/L1=/)
    await go('l1','&view=state');assert.equal(await page.locator('.state-table .disagree').count(),0)
    await go('l3');await page.getByRole('button',{name:'Enlarge drawing'}).click();assert.equal(await page.locator('dialog').evaluate(d=>d.open),true)
    assert.equal(await page.locator('dialog .schematic').count(),1)
    const font=await page.locator('dialog .schematic').evaluate(svg=>{const t=svg.querySelector('text');return parseFloat(getComputedStyle(t).fontSize)*svg.getBoundingClientRect().width/svg.viewBox.baseVal.width})
    assert.ok(font>=12,`enlarged labels are readable: ${font}px`)
    await page.screenshot({path:`shots/completion-enlarged-${width}.png`})
    await page.keyboard.press('Escape');assert.equal(await page.locator('dialog').evaluate(d=>d.open),false)
    assert.equal(await page.getByRole('button',{name:'Enlarge drawing'}).evaluate(b=>b===document.activeElement),true)
    await go('n1');await page.locator('.analysis-head').scrollIntoViewIfNeeded();await page.screenshot({path:`shots/completion-review-${width}.png`})
    console.log(`${width}px: all 30 additions, practice feedback/reset, design application, coupled state checks and keyboard-accessible enlarged drawing passed`)
  }
  assert.deepEqual(errors,[])
}finally{await browser.close()}
