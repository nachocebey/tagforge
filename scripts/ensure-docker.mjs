// Runs as the "predev" step before `npm run dev`. `docker compose up` can
// only talk to an already-running Docker daemon — on Windows/macOS that
// daemon belongs to the Docker Desktop GUI app, which has to be launched
// separately first. This launches it (if it's not already up) and waits
// until the daemon actually answers before handing off to `docker compose`.
import { execSync, spawn } from 'node:child_process'

const DOCKER_DESKTOP_WIN = 'C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe'
const TIMEOUT_MS = 120_000
const POLL_MS = 2000

function dockerReady() {
  try {
    execSync('docker info', { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

if (dockerReady()) {
  process.exit(0)
}

console.log('Docker daemon not reachable — starting Docker Desktop...')

if (process.platform === 'win32') {
  spawn(DOCKER_DESKTOP_WIN, [], { detached: true, stdio: 'ignore' }).unref()
} else if (process.platform === 'darwin') {
  spawn('open', ['-a', 'Docker'], { detached: true, stdio: 'ignore' }).unref()
} else {
  console.error('Auto-starting Docker is only wired up for Windows/macOS here — start the Docker daemon manually, then re-run npm run dev.')
  process.exit(1)
}

const deadline = Date.now() + TIMEOUT_MS
while (!dockerReady()) {
  if (Date.now() > deadline) {
    console.error('\nTimed out after 2 minutes waiting for Docker Desktop to start. Open it manually, wait for it to finish starting, then re-run npm run dev.')
    process.exit(1)
  }
  process.stdout.write('.')
  sleep(POLL_MS)
}

console.log('\nDocker is up.')
