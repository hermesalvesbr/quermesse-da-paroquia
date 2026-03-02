import fs from 'node:fs'
import path from 'node:path'

const rootDir = process.cwd()
const packageJsonPath = path.join(rootDir, 'package.json')
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
const version = packageJson.version

const sourceApkPath = path.join(
  rootDir,
  'platforms',
  'android',
  'app',
  'build',
  'outputs',
  'apk',
  'debug',
  'app-debug.apk',
)

if (!fs.existsSync(sourceApkPath)) {
  console.error('APK não encontrado em:')
  console.error(sourceApkPath)
  console.error('Execute primeiro: ns build android')
  process.exit(1)
}

const artifactDir = path.join(rootDir, 'artifacts', 'apk')
fs.mkdirSync(artifactDir, { recursive: true })

const versionedApkName = `quermesse-da-paroquia-v${version}.apk`
const versionedTargetPath = path.join(artifactDir, versionedApkName)
const latestTargetPath = path.join(artifactDir, 'quermesse-da-paroquia-latest.apk')

fs.copyFileSync(sourceApkPath, versionedTargetPath)
fs.copyFileSync(sourceApkPath, latestTargetPath)

console.log('APK organizado com sucesso:')
console.log(`- ${versionedTargetPath}`)
console.log(`- ${latestTargetPath}`)
