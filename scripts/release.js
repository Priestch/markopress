import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import c from 'picocolors'
import prompts from 'prompts'
import { execa } from 'execa'
import semver from 'semver'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const rootDir = resolve(__dirname, '..')
const packagesDir = join(rootDir, 'packages')

const versionIncrements = ['patch', 'minor', 'major']
const tags = ['latest', 'next']

// Get all packages from packages directory
function getPackages() {
  const packages = []
  const dirs = readdirSync(packagesDir, { withFileTypes: true })

  for (const dir of dirs) {
    if (!dir.isDirectory()) continue

    const pkgPath = join(packagesDir, dir.name, 'package.json')
    if (!existsSync(pkgPath)) continue

    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))

    // Skip private packages
    if (pkg.private) continue

    packages.push({
      name: pkg.name,
      version: pkg.version,
      path: join(packagesDir, dir.name)
    })
  }

  return packages
}

const run = (bin, args, opts = {}) =>
  execa(bin, args, { stdio: 'inherit', ...opts })
const step = (msg) => console.log(c.cyan(msg))

async function main() {
  const packages = getPackages()

  if (packages.length === 0) {
    console.error(c.red('No publishable packages found'))
    process.exit(1)
  }

  // Select package to release
  const { packageIndex } = await prompts({
    type: 'select',
    name: 'packageIndex',
    message: 'Select package to release',
    choices: packages.map((pkg, i) => ({
      title: `${pkg.name} (${pkg.version})`,
      value: i
    }))
  })

  if (packageIndex === undefined) {
    console.log(c.yellow('Release cancelled'))
    return
  }

  const pkg = packages[packageIndex]
  const currentVersion = pkg.version
  const pkgDir = pkg.path

  let targetVersion

  const versions = versionIncrements
    .map((i) => `${i} (${semver.inc(currentVersion, i)})`)
    .concat(['custom'])

  const { release } = await prompts({
    type: 'select',
    name: 'release',
    message: `Select release type for ${c.bold(pkg.name)}`,
    choices: versions
  })

  if (release === 3) {
    targetVersion = (
      await prompts({
        type: 'text',
        name: 'version',
        message: 'Input custom version',
        initial: currentVersion
      })
    ).version
  } else {
    targetVersion = versions[release].match(/\((.*)\)/)[1]
  }

  if (!semver.valid(targetVersion)) {
    throw new Error(`Invalid target version: ${targetVersion}`)
  }

  const { tag } = await prompts({
    type: 'select',
    name: 'tag',
    message: 'Select tag type',
    choices: tags
  })

  const { yes: tagOk } = await prompts({
    type: 'confirm',
    name: 'yes',
    message: `Releasing ${c.bold(pkg.name)} v${targetVersion} on ${c.bold(tags[tag])}. Confirm?`
  })

  if (!tagOk) {
    return
  }

  // Update the package version.
  step('\nUpdating the package version...')
  updatePackage(pkgDir, targetVersion)

  // Build the package.
  step('\nBuilding the package...')
  await run('pnpm', ['build'], { cwd: pkgDir })

  // Commit changes to the Git and create a tag.
  step('\nCommitting changes...')
  const pkgName = pkg.name.replace(/^@[^/]+\//, '') // Remove scope for cleaner commit message
  await run('git', ['add', 'package.json'], { cwd: pkgDir })
  await run('git', ['commit', '-m', `release: ${pkgName}@v${targetVersion}`])
  await run('git', ['tag', `${pkgName}-v${targetVersion}`])

  // Publish the package.
  step('\nPublishing the package...')
  await run('pnpm', [
    'publish',
    '--tag',
    tags[tag],
    '--ignore-scripts',
    '--no-git-checks'
  ], { cwd: pkgDir })

  // Push to GitHub.
  step('\nPushing to GitHub...')
  await run('git', ['push', 'origin', `refs/tags/${pkgName}-v${targetVersion}`])
  await run('git', ['push'])
}

function updatePackage(pkgDir, version) {
  const pkgPath = resolve(pkgDir, 'package.json')
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))

  pkg.version = version

  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
}

main().catch((err) => console.error(err))
