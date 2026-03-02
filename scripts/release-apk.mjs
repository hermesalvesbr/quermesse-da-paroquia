import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const rootDir = process.cwd()
const packageJsonPath = path.join(rootDir, 'package.json')
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
const version = packageJson.version
const tag = `v${version}`

const apkPath = path.join(rootDir, 'artifacts', 'apk', `quermesse-da-paroquia-v${version}.apk`)

if (!fs.existsSync(apkPath)) {
  console.error('APK versionado não encontrado:')
  console.error(apkPath)
  console.error('Execute primeiro: npm run apk:build')
  process.exit(1)
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })

  return result.status ?? 1
}

const releaseExistsStatus = spawnSync('gh', ['release', 'view', tag], {
  cwd: rootDir,
  stdio: 'ignore',
  shell: process.platform === 'win32',
}).status ?? 1

if (releaseExistsStatus === 0) {
  console.log(`Release ${tag} já existe. Fazendo upload/substituição do APK...`)
  const uploadStatus = run('gh', ['release', 'upload', tag, apkPath, '--clobber'])
  process.exit(uploadStatus)
}

console.log(`Criando release ${tag} e tag no GitHub...`)
const createStatus = run('gh', [
  'release',
  'create',
  tag,
  apkPath,
  '--title',
  tag,
  '--generate-notes',
])
process.exit(createStatus)
