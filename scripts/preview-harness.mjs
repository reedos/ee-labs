import { preview } from 'vite'
import net from 'node:net'
import { randomInt } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
export const root = fileURLToPath(new URL('../', import.meta.url))
export async function startPreview(lab) {
  let port
  for (let attempt = 0; attempt < 20; attempt++) {
    port = randomInt(49200, 49901)
    const probe = net.createServer()
    try {
      await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(port, '127.0.0.1', resolve) })
      await new Promise(resolve => probe.close(resolve))
      break
    } catch (error) { if (error.code !== 'EADDRINUSE') throw error; port = undefined }
  }
  if (!port) throw new Error('No available sprint preview port')
  const server = await preview({ root: path.join(root, 'apps', lab), logLevel: 'error', preview: { host: '127.0.0.1', port, strictPort: true } })
  console.log(`${lab}: preview port ${port}`)
  return { url: `http://127.0.0.1:${port}/`, port, close: () => new Promise((resolve, reject) => server.httpServer.close(error => error ? reject(error) : resolve())) }
}
