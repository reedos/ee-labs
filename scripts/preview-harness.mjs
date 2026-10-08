import { preview } from 'vite'
import { randomInt } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
export const root = fileURLToPath(new URL('../', import.meta.url))
// Ports come from 41000-41999. A failed bind (EADDRINUSE, EACCES, anything) just picks another port.
export async function startPreview(lab) {
  let lastError
  for (let attempt = 0; attempt < 40; attempt++) {
    const port = randomInt(41000, 42000)
    try {
      const server = await preview({ root: path.join(root, 'apps', lab), logLevel: 'error', preview: { host: '127.0.0.1', port, strictPort: true } })
      console.log(`${lab}: preview port ${port}`)
      return { url: `http://127.0.0.1:${port}/`, port, close: () => new Promise((resolve, reject) => server.httpServer.close(error => error ? reject(error) : resolve())) }
    } catch (error) { lastError = error }
  }
  throw new Error(`No available preview port in 41000-41999: ${lastError && lastError.message}`)
}
