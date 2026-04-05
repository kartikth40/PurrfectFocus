#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs'
import { execSync } from 'child_process'

const type = process.argv[2]

if (!['patch', 'minor', 'major'].includes(type)) {
  console.error('Usage: node scripts/bump-version.js <patch|minor|major>')
  process.exit(1)
}

const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'))

const [major, minor, patch] = pkg.version.split('.').map(Number)

const newVersion =
  type === 'major' ? `${major + 1}.0.0` :
  type === 'minor' ? `${major}.${minor + 1}.0` :
  `${major}.${minor}.${patch + 1}`

pkg.version = newVersion
manifest.version = newVersion

writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n')
writeFileSync('manifest.json', JSON.stringify(manifest, null, 4) + '\n')

// Create git commit and tag
execSync('git add package.json manifest.json', { stdio: 'inherit' })
execSync(`git commit -m "chore: bump version to ${newVersion}"`, { stdio: 'inherit' })
execSync(`git tag v${newVersion}`, { stdio: 'inherit' })

console.log(`\n✅ Bumped version: ${major}.${minor}.${patch} → ${newVersion}`)
console.log(`📌 Created tag: v${newVersion}`)
console.log(`\nRun "git push && git push --tags" to trigger the release pipeline.`)
