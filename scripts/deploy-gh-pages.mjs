import { execFileSync } from 'node:child_process'
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const distDir = join(root, 'dist')
const publishDir = join(root, '.gh-pages-publish')
const remoteUrl = 'https://github.com/RuiRDA/Simple-Personal-Workout-Tracker-PWA.git'
const safePublishDir = publishDir.replaceAll('\\', '/')

function run(command, args, options = {}) {
  execFileSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    ...options,
  })
}

function git(args) {
  run('git', ['-c', `safe.directory=${safePublishDir}`, ...args], {
    cwd: publishDir,
  })
}

function gitOutput(args) {
  return execFileSync('git', ['-c', `safe.directory=${safePublishDir}`, ...args], {
    cwd: publishDir,
    encoding: 'utf8',
  }).trim()
}

console.log('Building GitHub Pages bundle...')
if (process.env.npm_execpath) {
  run(process.execPath, [process.env.npm_execpath, 'run', 'build'], {
    env: {
      ...process.env,
      GITHUB_ACTIONS: 'true',
    },
  })
} else {
  run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build'], {
    env: {
      ...process.env,
      GITHUB_ACTIONS: 'true',
    },
    shell: process.platform === 'win32',
  })
}

mkdirSync(publishDir, { recursive: true })

if (!existsSync(join(publishDir, '.git'))) {
  run('git', ['init'], { cwd: publishDir })
  git(['checkout', '-b', 'gh-pages'])
  git(['remote', 'add', 'origin', remoteUrl])
} else {
  const branch = gitOutput(['branch', '--show-current'])
  if (branch !== 'gh-pages') {
    git(['checkout', 'gh-pages'])
  }

  const remotes = gitOutput(['remote'])
  if (!remotes.split('\n').includes('origin')) {
    git(['remote', 'add', 'origin', remoteUrl])
  }
}

for (const entry of readdirSync(publishDir)) {
  if (entry === '.git') continue
  rmSync(join(publishDir, entry), { force: true, recursive: true })
}

cpSync(distDir, publishDir, { recursive: true })
writeFileSync(join(publishDir, '.nojekyll'), '')

git(['add', '-A'])

let hasChanges = true
try {
  execFileSync('git', [
    '-c',
    `safe.directory=${safePublishDir}`,
    'diff',
    '--cached',
    '--quiet',
  ], { cwd: publishDir })
  hasChanges = false
} catch {
  hasChanges = true
}

if (hasChanges) {
  git(['commit', '-m', 'Deploy GitHub Pages'])
} else {
  console.log('No gh-pages changes to commit.')
}

git(['push', 'origin', 'gh-pages'])
console.log('Published gh-pages.')
