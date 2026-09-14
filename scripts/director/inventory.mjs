import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createServer } from 'vite'

const ROOT = fileURLToPath(new URL('../../', import.meta.url))
const LEGACY = {
  'circuit-lab': ['lessons.js', 'LESSONS'],
  'control-lab': ['lessons.js', 'LESSONS'],
  'signal-lab': ['presets.js', 'PRESETS'],
  // Lesson-only apps register their curriculum as EXTENDED for the shared CurriculumApp.
  'applied-analog-lab': ['extended.js', 'EXTENDED'],
  'analog-ic-lab': ['extended.js', 'EXTENDED'],
  'mixed-signal-lab': ['extended.js', 'EXTENDED'],
}

export function summarize(slug, records) {
  if (!Array.isArray(records) || records.length === 0) {
    throw new Error(`${slug}: the curriculum registry is empty or missing`)
  }
  const ids = records.map((record) => record.id ?? record.name)
  if (ids.some((id) => typeof id !== 'string' || !id.trim())) {
    throw new Error(`${slug}: a curriculum record has no id or name`)
  }
  if (new Set(ids).size !== ids.length) throw new Error(`${slug}: duplicate curriculum ids`)
  return {
    slug,
    count: records.length,
    groups: [...new Set(records.map((record) => record.group).filter(Boolean))],
    ids,
  }
}

export async function inventory(root = ROOT) {
  // Vite loads the same workspace modules as the apps, including JSX imports.
  const server = await createServer({
    root,
    configFile: false,
    server: { middlewareMode: true, hmr: false, watch: null },
    appType: 'custom',
  })
  try {
    const rows = []
    for (const entry of readdirSync(join(root, 'apps'), { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const slug = entry.name
      if (!existsSync(join(root, 'apps', slug, 'package.json'))) continue
      const [file, key] = LEGACY[slug] ?? ['experiments.js', 'EXPERIMENTS']
      const module = await server.ssrLoadModule(`/apps/${slug}/src/${file}`)
      const releasePath = join(root, 'apps', slug, 'RELEASE_STATUS')
      const release = existsSync(releasePath) ? readFileSync(releasePath, 'utf8').trim() : 'legacy'
      if (!['dark', 'released', 'legacy'].includes(release)) {
        throw new Error(`${slug}: unknown release status ${release}`)
      }
      rows.push({ ...summarize(slug, module[key]), release,
        harness: existsSync(join(root, 'apps', slug, 'scripts', 'verify.mjs')) })
    }
    return rows.sort((a, b) => a.slug.localeCompare(b.slug))
  } finally {
    await server.close()
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const rows = await inventory()
  console.log(JSON.stringify(rows, null, 2))
}
