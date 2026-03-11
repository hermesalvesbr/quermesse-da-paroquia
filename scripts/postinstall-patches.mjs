/**
 * Patches @nativescript/vite for Windows compatibility.
 *
 * Bug: `new URL(import.meta.url).pathname` on Windows returns `/C:/Users/...`
 * which `path.resolve` turns into `C:\C:\Users\...` (double drive letter).
 *
 * Fix: Use `fileURLToPath(import.meta.url)` instead (standard Node.js API).
 *
 * Also fixes `mainEntry` path in main-entry.js where Windows backslashes
 * are interpreted as escape sequences inside template literals.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

function patchFile(relPath, patches) {
  const filePath = resolve(root, 'node_modules', relPath)
  let content
  try {
    content = readFileSync(filePath, 'utf8')
  } catch {
    console.warn(`[postinstall] skip: ${relPath} not found`)
    return
  }

  let changed = false
  for (const [search, replacement] of patches) {
    if (content.includes(search)) {
      content = content.replaceAll(search, replacement)
      changed = true
    }
  }
  if (changed) {
    writeFileSync(filePath, content)
    console.log(`[postinstall] patched: ${relPath}`)
  }
}

// 1. base.js — fix URL.pathname double-drive on Windows
patchFile('@nativescript/vite/configuration/base.js', [
  [
    "import { pathToFileURL } from 'node:url';",
    "import { pathToFileURL, fileURLToPath } from 'node:url';",
  ],
  [
    'path.dirname(new URL(import.meta.url).pathname)',
    'path.dirname(fileURLToPath(import.meta.url))',
  ],
])

// 2. base.js — fix glob paths with backslashes on Windows (vite-plugin-static-copy)
// Normalize resolveFromAppRoot to use forward slashes for glob compatibility
patchFile('@nativescript/vite/configuration/base.js', [
  [
    "const resolveFromAppRoot = (subPath) => path.resolve(projectRoot, getProjectAppRelativePath(subPath));",
    "const resolveFromAppRoot = (subPath) => path.resolve(projectRoot, getProjectAppRelativePath(subPath)).replace(/\\\\/g, '/');"
  ],
])

// 3. project.js — fix __dirname double-drive on Windows
patchFile('@nativescript/vite/helpers/project.js', [
  [
    'dirname(new URL(import.meta.url).pathname)',
    'dirname(fileURLToPath(import.meta.url))',
  ],
])
// Add fileURLToPath import to project.js only if not already present
{
  const projPath = resolve(root, 'node_modules', '@nativescript/vite/helpers/project.js')
  let content = readFileSync(projPath, 'utf8')
  if (!content.includes('fileURLToPath')) {
    content = content.replace(
      "import { resolve, dirname } from 'path';",
      "import { resolve, dirname } from 'path';\nimport { fileURLToPath } from 'node:url';"
    )
    writeFileSync(projPath, content)
    console.log('[postinstall] added fileURLToPath import to project.js')
  }
  // Remove duplicate import line if present
  const dupImport = "import { fileURLToPath } from 'node:url';\nimport { fileURLToPath } from 'node:url';"
  if (content.includes(dupImport)) {
    content = content.replace(dupImport, "import { fileURLToPath } from 'node:url';")
    writeFileSync(projPath, content)
    console.log('[postinstall] removed duplicate fileURLToPath import from project.js')
  }
}

// 4. main-entry.js — fix backslash escape in import path
const mainEntrySearch = "import '" + '${' + "mainEntry}'"
const mainEntryReplacement = "import '" + '${' + "mainEntry.replace(/\\\\/g, '/')}'"
patchFile('@nativescript/vite/helpers/main-entry.js', [
  [
    mainEntrySearch,
    mainEntryReplacement,
  ],
])
