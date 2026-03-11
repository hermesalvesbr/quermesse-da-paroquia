import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, mergeConfig, UserConfig, Plugin } from 'vite'
import { vueConfig } from '@nativescript/vite'

function forceBundleMjsMainPlugin(): Plugin {
  return {
    name: 'force-bundle-mjs-main',
    apply: 'build',
    closeBundle() {
      const outDir = resolve(process.cwd(), '.ns-vite-build')
      const packageJsonPath = resolve(outDir, 'package.json')
      const bundlePath = resolve(outDir, 'bundle.mjs')

      if (existsSync(packageJsonPath)) {
        try {
          const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8'))
          if (pkg.main !== 'bundle.mjs') {
            pkg.main = 'bundle.mjs'
            writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2))
          }
        }
        catch {
          // noop: keep build running even if patching fails
        }
      }

      if (existsSync(bundlePath)) {
        try {
          const bundle = readFileSync(bundlePath, 'utf8')
          const patched = bundle.replace('"main":"bundle"', '"main":"bundle.mjs"')
          if (patched !== bundle) {
            writeFileSync(bundlePath, patched)
          }
        }
        catch {
          // noop: keep build running even if patching fails
        }
      }
    },
  }
}

export default defineConfig(({ mode }): UserConfig => {
  return mergeConfig(vueConfig({ mode }), {
    plugins: [forceBundleMjsMainPlugin()],
    define: {
      __DIRECTUS_URL__: JSON.stringify(process.env.DIRECTUS_URL || ''),
      __DIRECTUS_TOKEN__: JSON.stringify(process.env.DIRECTUS_TOKEN || ''),
    },
  })
})
