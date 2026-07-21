// Lance les émulateurs Firebase (Auth + Firestore + UI) avec persistance des données.
//
// - Au démarrage : importe les données de ./.emulator-data si le dossier existe.
// - À l'arrêt (Ctrl+C) : réexporte les données vers ./.emulator-data.
//
// Les données (sessions créées, comptes de test, etc.) survivent donc d'une
// session de dev à l'autre. Le dossier ./.emulator-data est git-ignoré.

import { existsSync, readFileSync } from 'node:fs'
import { spawn, spawnSync, execFileSync } from 'node:child_process'

const DATA_DIR = './.emulator-data'

// Le CLI Firebase exige Node >= 20.
const major = Number(process.versions.node.split('.')[0])
if (major < 20) {
  console.error(
    `\n✖ Node ${process.versions.node} détecté : le CLI Firebase exige Node >= 20.\n` +
      `  Lance d'abord :  nvm use   (un .nvmrc fixe la version à 22)\n`,
  )
  process.exit(1)
}

// Renvoie la version majeure du `java` qui serait utilisé (via JAVA_HOME sinon
// le PATH), ou null si aucun n'est trouvé. `java -version` écrit sur stderr.
function currentJavaMajor() {
  const javaBin = process.env.JAVA_HOME ? `${process.env.JAVA_HOME}/bin/java` : 'java'
  const res = spawnSync(javaBin, ['-version'], { encoding: 'utf8' })
  if (res.error) return null
  const m = `${res.stdout}${res.stderr}`.match(/version "(\d+)(?:\.(\d+))?/)
  if (!m) return null
  // Les vieux JDK s'annoncent « 1.8 » : la majeure est alors le 2e nombre.
  return Number(m[1] === '1' ? m[2] : m[1])
}

// Les émulateurs tournent sur la JVM et firebase-tools exige désormais Java >= 21.
// Sur macOS, si le Java courant est trop vieux (ou absent) — par ex. un
// `JAVA_HOME` fixé sur openjdk@11 dans ~/.zprofile, ou un keg-only qui passe
// devant dans le PATH — on bascule sur un JDK >= 21 installé, au lieu de
// planter avec « no longer supports Java version before 21 ».
if (process.platform === 'darwin') {
  const major = currentJavaMajor()
  if (major === null || major < 21) {
    try {
      const home = execFileSync('/usr/libexec/java_home', ['-v', '21+'], {
        encoding: 'utf8',
      }).trim()
      if (home) {
        process.env.JAVA_HOME = home
        process.env.PATH = `${home}/bin:${process.env.PATH}`
      }
    } catch {
      // Aucun JDK >= 21 trouvé : firebase affichera son propre message d'erreur.
    }
  }
}

// --- Nettoyage des émulateurs orphelins ---------------------------------------
// Un émulateur (la JVM Firestore, le hub…) tourne comme process *enfant* du CLI.
// Si l'arrêt n'est pas propre (kill du parent seul, « stop » de l'IDE, crash),
// l'enfant est ré-attaché à init (PPID 1) et continue de tenir son port : au
// lancement suivant, Firebase plante avec « port taken ».
//
// Avant de démarrer, on inspecte les ports de CE projet (lus depuis
// firebase.json, source unique). Si un port est tenu par un émulateur Firebase
// ORPHELIN (PPID 1), on le tue. S'il est tenu par autre chose (un autre projet
// qui tournerait, un process tiers), on NE touche à rien et on s'arrête avec un
// message clair — on ne casse jamais ce qui ne nous appartient pas.

function projectEmulatorPorts() {
  try {
    const emu = JSON.parse(readFileSync('firebase.json', 'utf8')).emulators ?? {}
    return [
      emu.auth?.port,
      emu.firestore?.port,
      emu.firestore?.websocketPort,
      emu.storage?.port,
      emu.functions?.port,
      emu.ui?.port,
      emu.hub?.port,
      emu.logging?.port,
    ].filter((p) => typeof p === 'number')
  } catch {
    return []
  }
}

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

function listenerPids(port) {
  const res = spawnSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'], {
    encoding: 'utf8',
  })
  if (res.error || !res.stdout) return []
  return [...new Set(res.stdout.split('\n').map((s) => s.trim()).filter(Boolean))]
}

function procInfo(pid) {
  const res = spawnSync('ps', ['-o', 'ppid=,command=', '-p', String(pid)], {
    encoding: 'utf8',
  })
  if (res.error || !res.stdout.trim()) return null
  const line = res.stdout.trim()
  return { ppid: Number(line.split(/\s+/)[0]), command: line.replace(/^\s*\d+\s+/, '') }
}

function reapOrphanEmulators() {
  if (process.platform === 'win32') return // pas de lsof/ps fiables ici
  let killed = false
  for (const port of projectEmulatorPorts()) {
    for (const pid of listenerPids(port)) {
      const info = procInfo(pid)
      if (!info) continue
      const isFirebaseEmu = /firebase[/\\]emulators|cloud-firestore-emulator|firebase-tools/.test(
        info.command,
      )
      if (isFirebaseEmu && info.ppid === 1) {
        console.log(`ℹ Émulateur Firebase orphelin sur le port ${port} (pid ${pid}) — nettoyage…`)
        try {
          process.kill(Number(pid), 'SIGTERM')
        } catch {
          /* déjà mort */
        }
        killed = true
      } else {
        console.error(
          `\n✖ Le port ${port} est déjà occupé par un autre process (pid ${pid}) :\n` +
            `    ${info.command}\n` +
            `  Ce n'est pas un émulateur orphelin de ce projet, je n'y touche pas.\n` +
            `  Arrête-le (ou change le port dans firebase.json), puis relance.\n`,
        )
        process.exit(1)
      }
    }
  }
  if (killed) sleepSync(1500) // laisser le port se libérer
}

reapOrphanEmulators()

// Storage et Functions sont nécessaires au studio auteurs (/studio/:token) :
// upload direct vers la zone de staging (règles cross-service Storage→Firestore)
// puis callable de finalisation. Les functions sont compilées à la volée par
// l'émulateur depuis functions/lib (penser à `npm --prefix functions run build`).
const args = [
  'emulators:start',
  '--only',
  'auth,firestore,storage,functions',
  '--export-on-exit',
  DATA_DIR,
]

if (existsSync(DATA_DIR)) {
  args.push('--import', DATA_DIR)
} else {
  console.log(`ℹ Premier lancement : ${DATA_DIR} sera créé à l'arrêt des émulateurs.`)
}

const child = spawn('firebase', args, { stdio: 'inherit', shell: process.platform === 'win32' })

// Quand `run-p` (ou un `kill`) nous envoie SIGTERM parce qu'un autre process est
// mort, on relaie le signal au CLI Firebase pour qu'il fasse son arrêt propre
// (export-on-exit + extinction de la JVM) au lieu de la laisser orpheline.
// On ne relaie pas SIGINT : un Ctrl+C interactif est déjà délivré à tout le
// groupe, donc le CLI le reçoit directement — le relayer le doublerait et
// forcerait un arrêt brutal (« send the signal again to stop right now »).
process.on('SIGTERM', () => {
  if (child.pid && !child.killed) {
    try {
      child.kill('SIGTERM')
    } catch {
      /* déjà parti */
    }
  }
})

child.on('exit', (code) => process.exit(code ?? 0))
child.on('error', (err) => {
  console.error('✖ Impossible de lancer le CLI Firebase :', err.message)
  process.exit(1)
})
