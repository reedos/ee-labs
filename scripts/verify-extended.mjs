import assert from 'node:assert/strict'
import {createServer} from 'node:http'
import {readFile,mkdir} from 'node:fs/promises'
import {existsSync} from 'node:fs'
import {resolve,extname,sep} from 'node:path'
import {pathToFileURL,fileURLToPath} from 'node:url'
import {chromium} from 'playwright'
const lab=process.argv[2],app=resolve(fileURLToPath(new URL('../apps/',import.meta.url)),lab),dist=resolve(app,'dist')
const {EXTENDED}=await import(pathToFileURL(resolve(app,'src/extended.js')))
const foundationPath=resolve(app,'src/experiments.js')
const foundationId=existsSync(foundationPath)?(await import(pathToFileURL(foundationPath))).EXPERIMENTS[0]?.id:null
const server=createServer(async(req,res)=>{try{const path=resolve(dist,decodeURIComponent(new URL(req.url,'http://localhost').pathname.slice(lab.length+2))||'index.html');assert(path.startsWith(dist+sep));res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2'})[extname(path)]||'application/octet-stream');res.end(await readFile(path))}catch{res.writeHead(404).end()}})
await new Promise(done=>server.listen(0,'127.0.0.1',done));const browser=await chromium.launch({headless:true})
try{
  for(const width of [1440,390,320]){
    const page=await browser.newPage({viewport:{width,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message))
    await page.goto(`http://127.0.0.1:${server.address().port}/${lab}/#${EXTENDED[0].id}`)
    for(const lesson of EXTENDED){
      await page.getByLabel('Experiment',{exact:true}).selectOption(lesson.id)
      await page.getByRole('navigation',{name:'Analysis views'}).waitFor()
      let anchor,layoutAnchor
      for(const view of ['Start here','Worked math','Explore','Practice']){
        const button=page.getByRole('button',{name:view,exact:true});await button.click()
        const tabs=page.locator('.lesson-tabs');await tabs.scrollIntoViewIfNeeded();const box=await tabs.boundingBox()
        const rel=await button.evaluate(el=>({x:el.offsetLeft,y:el.offsetTop,w:el.offsetWidth,h:el.offsetHeight}))
        anchor??=box
        const layout=await tabs.locator('button').evaluateAll(buttons=>buttons.map(el=>({text:el.textContent,x:el.offsetLeft,y:el.offsetTop,w:el.offsetWidth,h:el.offsetHeight})))
        layoutAnchor??=layout;assert.deepEqual(layout,layoutAnchor,`${lesson.id}: analysis tabs moved`)
        assert(Math.abs(box.height-anchor.height)<1,`${lesson.id}: tab height changes`)
        assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${lesson.id}/${view}/${width}: overflow`)
        if(width<760) assert(await page.locator('#root').evaluate(el=>el.scrollHeight<=el.clientHeight+1),`${lesson.id}: nested mobile page scroll`)
        assert.equal(await page.locator('.katex-error').count(),0,`${lesson.id}: invalid math`)
        assert.equal(await page.getByRole('alert').count(),0,`${lesson.id}: refusal at defaults`)
        if(view==='Start here'&&await page.getByRole('button',{name:'Enlarge circuit',exact:true}).count()){
          await page.getByRole('button',{name:'Enlarge circuit',exact:true}).click();await page.getByRole('dialog',{name:'Enlarged circuit'}).waitFor();assert(await page.getByRole('button',{name:'Close circuit',exact:true}).evaluate(el=>el===document.activeElement));await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').count(),0);
        }
        if(view==='Worked math')assert(await page.locator('.lesson-step .katex').count()>=3,`${lesson.id}: missing formulas`)
        if(view==='Practice'){
          await page.getByRole('button',{name:'Check answer',exact:true}).click();await page.getByRole('status').filter({hasText:'finite'}).waitFor()
          await page.getByRole('button',{name:'Reveal answer',exact:true}).click();assert(await page.getByRole('button',{name:'Hide answer'}).isVisible())
        }
      }
    }
    assert.deepEqual(errors,[])
    if(foundationId){
      await page.getByLabel('Experiment',{exact:true}).selectOption(foundationId)
      assert.equal(await page.locator('.lesson-workbench').count(),0,'Can return to foundation')
    }
    await page.getByLabel('Experiment',{exact:true}).selectOption(EXTENDED[0].id)
    await page.getByRole('navigation',{name:'Analysis views'}).waitFor()
    await page.getByRole('button',{name:'Worked math',exact:true}).click()
    await mkdir(resolve(app,'.shots'),{recursive:true});await page.screenshot({path:resolve(app,'.shots',`extended-${width}.png`),fullPage:true})
    console.log(`${lab}: ${EXTENDED.length} lessons × 4 views at ${width}px passed`);await page.close()
  }
}finally{await browser.close();server.close()}
