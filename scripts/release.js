import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { resolve, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import c from 'picocolors'
import prompts from 'prompts'
import { execa } from 'execa'
import semver from 'semver'

const DRY_RUN = process.argv.includes('--dry-run')

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

const run = (bin, args, opts = {}) => {
  if (DRY_RUN) {
    console.log(c.gray(`[dry-run] ${bin} ${args.join(' ')}`))
    return { stdout: '', stderr: '' }
  }
  return execa(bin, args, { stdio: 'inherit', ...opts })
}

// Always executes regardless of DRY_RUN (read-only git operations)
const runRead = (bin, args, opts = {}) =>
  execa(bin, args, { stdio: 'pipe', ...opts })

const step = (msg) => console.log(c.cyan(msg))

// Conventional commit type → changelog section title
const COMMIT_TYPES = {
  feat: '✨ Features',
  fix: '🐛 Bug Fixes',
  perf: '⚡ Performance Improvements',
  refactor: '♻️ Refactoring',
  docs: '📝 Documentation',
  build: '🏗️ Build System',
  ci: '👷 CI/CD',
  test: '✅ Tests',
  chore: '🔧 Chores'
}

async function getLastTag(pkgName) {
  try {
    const { stdout } = await runRead('git', [
      'tag', '--sort=-creatordate', '--list', `${pkgName}-v*`
    ], { cwd: rootDir })
    const tags = stdout.trim().split('\n').filter(Boolean)
    return tags[0] || null
  } catch {
    return null
  }
}

async function getCommitsSince(tag, pkgDir) {
  const range = tag ? `${tag}..HEAD` : 'HEAD'
  const relPath = relative(rootDir, pkgDir)
  try {
    const { stdout } = await runRead('git', [
      'log', range, '--format=%H|%s', '--', relPath
    ], { cwd: rootDir })
    return stdout.trim().split('\n').filter(Boolean)
  } catch {
    return []
  }
}

function parseConventionalCommit(line) {
  const [hash, ...rest] = line.split('|')
  const subject = rest.join('|')
  // Matches: type(scope)!: description  or  type!: description  or  type: description
  const match = subject.match(/^(\w+)(\([^)]+\))?(!)?:\s+(.+)$/)
  if (!match) return null
  const [, type, scope, breaking, description] = match
  return {
    hash: hash.substring(0, 7),
    type,
    scope: scope ? scope.slice(1, -1) : null,
    breaking: !!breaking,
    description
  }
}

function generateChangelogEntry(version, commits) {
  const date = new Date().toISOString().split('T')[0]
  const categories = { breaking: [], ...Object.fromEntries(Object.keys(COMMIT_TYPES).map(k => [k, []])) }

  for (const line of commits) {
    const commit = parseConventionalCommit(line)
    if (!commit) continue
    if (commit.breaking) categories.breaking.push(commit)
    if (categories[commit.type]) categories[commit.type].push(commit)
  }

  const sections = [
    { key: 'breaking', title: '⚠️ Breaking Changes' },
    ...Object.entries(COMMIT_TYPES).map(([key, title]) => ({ key, title }))
  ]

  let content = `## [${version}] - ${date}\n\n`
  let hasContent = false

  for (const { key, title } of sections) {
    if (!categories[key] || categories[key].length === 0) continue
    hasContent = true
    content += `### ${title}\n\n`
    for (const commit of categories[key]) {
      const scope = commit.scope ? `**${commit.scope}:** ` : ''
      content += `- ${scope}${commit.description} ([${commit.hash}](https://github.com/Priestch/markopress/commit/${commit.hash}))\n`
    }
    content += '\n'
  }

  if (!hasContent) {
    content += '_No significant changes_\n\n'
  }

  return content
}

function updateChangelog(changelogPath, entry) {
  const header = '# Changelog\n\n'
  let existing = ''
  if (existsSync(changelogPath)) {
    existing = readFileSync(changelogPath, 'utf-8').replace(/^# Changelog\n\n/, '')
  }
  // Ensure blank line between entries
  writeFileSync(changelogPath, header + entry + '\n' + existing)
}

async function main() {
  if (DRY_RUN) {
    console.log(c.yellow('🧪 DRY RUN MODE - No actual changes will be made\n'))
  }

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

  // Pre-release checks
  step('\nRunning pre-release checks...')

  // Check if working directory is clean
  const { stdout: gitStatus } = await run('git', ['status', '--porcelain'], {
    cwd: rootDir,
    stdio: 'pipe'
  })

  if (gitStatus.trim()) {
    console.warn(c.yellow('⚠️  Warning: Working directory has uncommitted changes'))
    const { proceed } = await prompts({
      type: 'confirm',
      name: 'proceed',
      message: 'Continue with release anyway?',
      initial: false
    })
    if (!proceed) {
      console.log(c.yellow('Release cancelled'))
      return
    }
  }

  // Update the package version.
  step('\nUpdating the package version...')
  updatePackage(pkgDir, targetVersion)

  const pkgName = pkg.name.replace(/^@[^/]+\//, '') // Remove scope for tag/commit message and changelog lookup

  // Generate changelog.
  step('\nGenerating changelog...')
  const lastTag = await getLastTag(pkgName)
  const commits = await getCommitsSince(lastTag, pkgDir)
  if (lastTag) {
    console.log(c.gray(`  Commits since ${lastTag}: ${commits.length}`))
  } else {
    console.log(c.gray(`  No previous tag found, including all commits (${commits.length})`))
  }
  const changelogEntry = generateChangelogEntry(targetVersion, commits)
  const changelogPath = join(pkgDir, 'CHANGELOG.md')
  if (!DRY_RUN) {
    updateChangelog(changelogPath, changelogEntry)
    console.log(c.green('✓ CHANGELOG.md updated'))
  } else {
    console.log(c.gray('[dry-run] Would update CHANGELOG.md:'))
    console.log(c.gray(changelogEntry))
  }

  // Build the package.
  step('\nBuilding the package...')
  await run('pnpm', ['build'], { cwd: pkgDir })

  // Verify build output exists
  if (!DRY_RUN) {
    const distDir = resolve(pkgDir, 'dist')
    if (!existsSync(distDir)) {
      throw new Error(`Build failed: ${distDir} does not exist`)
    }
    console.log(c.green('✓ Build output verified'))
  }

  // Commit changes to the Git and create a tag.
  step('\nCommitting changes...')

  // Stage all changes (root + package)
  await run('git', ['add', '-A'], { cwd: rootDir })
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
