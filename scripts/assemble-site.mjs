// Assemble the deployed site locally, and optionally serve it.
//
// WHY THIS EXISTS
//
// Every lab's verify.mjs has always run against `vite preview`, which serves
// one lab alone at the root of a bare port. The deployed site is not that. It
// is `_site/`: one index.html and each lab's dist under its own folder, so a
// student meets Signal Lab at `/signal-lab/` with four siblings beside it.
//
// The difference is not cosmetic. `packages/ui/src/deeplink.js`'s siblingUrl()
// and homeUrl() both resolve to NULL on a bare port, by design — there are no
// siblings to point at. So every piece of cross-lab chrome renders nothing at
// all under `vite preview`: LabNav's row, every lab's HandOver link, Signal's
// suite-nav popover. A probe run against a bare preview does not measure that
// chrome and find it good. It finds no instances of it and passes on an empty
// set.
//
// That is not hypothetical. Round-four grading found Signal Lab's hand-over
// link at 115x16 px on a phone, well under the 44 px floor, while the lab's
// own touch-target probe reported every element clearing 44 px. Nothing was on
// an exception list. The link simply was not there to measure. Served under a
// real `/signal-lab/` path, the unmodified probe reproduced the failure on the
// first run. The same blind spot covers all five labs.
//
// So: build the labs, lay them out exactly as .github/workflows/deploy.yml
// lays them out, and serve that. `APP_URL=http://localhost:PORT/signal-lab/`
// then points a harness at what a student actually loads.
//
// USAGE
//   node scripts/assemble-site.mjs              assemble only
//   node scripts/assemble-site.mjs --serve       assemble, then serve on 47600
//   node scripts/assemble-site.mjs --serve --port 47599
//   node scripts/assemble-site.mjs --serve --no-assemble    serve what is there
//
// This mirrors the workflow's "Assemble the site" step. If that step changes,
// change this with it — a harness that measures a layout the deploy does not
// produce is the same bug in a new place.

import { createServer } from 'node:http'
import { cp, mkdir, readFile, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { extname, join, normalize, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const SITE = join(ROOT, '_site')

// The folder name each lab is served under. These are the paths in the
// deployed URLs, so deeplink.js's own app list must agree with them.
export const LABS = [
  'signal-lab',
  'circuit-lab',
  'control-lab',
  // Dark-launched: built and served at its URL, linked from nowhere until its
  // own RELEASE_STATUS says `released`. It still has to BE at that URL, which
  // is exactly why it is assembled here.
  'circuit-elements-lab',
  'power-lab',
]

export async function assemble({ labs = LABS, quiet = false } = {}) {
  const missing = labs.filter((l) => !existsSync(join(ROOT, 'apps', l, 'dist', 'index.html')))
  if (missing.length) {
    throw new Error(
      `no build to assemble for: ${missing.join(', ')}\n` +
        `Run \`npm run build\` first, or \`npx vite build apps/<lab>\` for one.`,
    )
  }

  await rm(SITE, { recursive: true, force: true })
  await mkdir(SITE, { recursive: true })
  for (const f of ['index.html', 'icon-512.png', 'icon-180.png']) {
    await cp(join(ROOT, 'site', f), join(SITE, f))
  }
  for (const lab of labs) {
    await cp(join(ROOT, 'apps', lab, 'dist'), join(SITE, lab), { recursive: true })
  }
  if (!quiet) console.log(`assembled _site: index + ${labs.join(', ')}`)
  return SITE
}

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
}

export function serveSite({ port = 47600, root = SITE, quiet = false } = {}) {
  const server = createServer(async (req, res) => {
    // Strip the query and the fragment. Every lab's deep links live in the
    // hash, so the path alone decides the file.
    let pathname
    try {
      pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
    } catch {
      res.writeHead(400).end('bad request')
      return
    }
    if (pathname.endsWith('/')) pathname += 'index.html'

    // Contain the path inside the served root: a resolved target that does not
    // start with the root is a traversal attempt and gets nothing.
    const target = resolve(root, '.' + normalize(pathname))
    if (target !== root && !target.startsWith(root + sep)) {
      res.writeHead(403).end('forbidden')
      return
    }

    try {
      const body = await readFile(target)
      res.writeHead(200, {
        'content-type': TYPES[extname(target).toLowerCase()] || 'application/octet-stream',
        // A harness that re-reads a rebuilt file must not be handed the old
        // one out of the browser's cache.
        'cache-control': 'no-store',
      })
      res.end(body)
    } catch {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('not found')
    }
  })
  return new Promise((ok, err) => {
    server.once('error', err)
    server.listen(port, () => {
      if (!quiet) {
        console.log(`serving _site on http://localhost:${port}/`)
        for (const lab of LABS) {
          if (existsSync(join(root, lab))) console.log(`   http://localhost:${port}/${lab}/`)
        }
      }
      ok(server)
    })
  })
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
if (invokedDirectly) {
  const argv = process.argv.slice(2)
  const flag = (name) => argv.includes(name)
  const value = (name, fallback) => {
    const i = argv.indexOf(name)
    return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback
  }
  const only = value('--labs', '')
  const labs = only ? only.split(',').map((s) => s.trim()).filter(Boolean) : LABS

  if (!flag('--no-assemble')) await assemble({ labs })
  if (flag('--serve')) await serveSite({ port: Number(value('--port', 47600)) })
}
