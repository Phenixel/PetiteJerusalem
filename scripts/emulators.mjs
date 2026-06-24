// Lance les émulateurs Firebase (Auth + Firestore + UI) avec persistance des données.
//
// - Au démarrage : importe les données de ./.emulator-data si le dossier existe.
// - À l'arrêt (Ctrl+C) : réexporte les données vers ./.emulator-data.
//
// Les données (sessions créées, comptes de test, etc.) survivent donc d'une
// session de dev à l'autre. Le dossier ./.emulator-data est git-ignoré.

import { existsSync } from 'node:fs'
import { spawn, execFileSync } from 'node:child_process'

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

// Les émulateurs tournent sur la JVM et firebase-tools exige désormais Java >= 21.
// Sur macOS, si `JAVA_HOME` n'est pas déjà fixé, on pointe sur le JDK >= 21
// installé (utile quand un openjdk@11 keg-only passe devant dans le PATH), au
// lieu de planter avec « no longer supports Java version before 21 ».
if (process.platform === 'darwin' && !process.env.JAVA_HOME) {
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

const args = [
  'emulators:start',
  '--only',
  'auth,firestore',
  '--export-on-exit',
  DATA_DIR,
]

if (existsSync(DATA_DIR)) {
  args.push('--import', DATA_DIR)
} else {
  console.log(`ℹ Premier lancement : ${DATA_DIR} sera créé à l'arrêt des émulateurs.`)
}

const child = spawn('firebase', args, { stdio: 'inherit', shell: process.platform === 'win32' })
child.on('exit', (code) => process.exit(code ?? 0))
child.on('error', (err) => {
  console.error('✖ Impossible de lancer le CLI Firebase :', err.message)
  process.exit(1)
})
