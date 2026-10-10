import fs from 'node:fs'
import path from 'node:path'
import {spawn} from 'node:child_process'
import {startPreview,root} from './preview-harness.mjs'
const labs=process.argv.slice(2).length?process.argv.slice(2):fs.readdirSync(path.join(root,'apps'))
const out=path.resolve(process.env.SHOTS_DIR||'shots/astra-ee2');fs.mkdirSync(out,{recursive:true})
const results=[]
for(const lab of labs){
 const server=await startPreview(lab)
 const log=fs.openSync(path.join(out,`${lab}-verify.log`),'w')
 try{
  const code=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,['scripts/verify.mjs'],{cwd:path.join(root,'apps',lab),env:{...process.env,APP_URL:server.url,SHOTS_DIR:path.join(out,lab)},stdio:['ignore',log,log],windowsHide:true});child.on('error',reject);child.on('close',resolve)})
  results.push({lab,port:server.port,code});console.log(`${lab}: ${code===0?'PASS':'FAIL '+code}`)
 }finally{fs.closeSync(log);await server.close()}
 fs.writeFileSync(path.join(out,'harness-results.json'),JSON.stringify(results,null,2))
}
process.exitCode=results.some(r=>r.code!==0)?1:0
