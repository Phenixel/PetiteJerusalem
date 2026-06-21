// Lance les émulateurs Firebase (Auth + Firestore + UI) avec persistance des données.
//
// - Au démarrage : importe les données de ./.emulator-data si le dossier existe.
// - À l'arrêt (Ctrl+C) : réexporte les données vers ./.emulator-data.
//
// Les données (sessions créées, comptes de test, etc.) survivent donc d'une
// session de dev à l'autre. Le dossier ./.emulator-data est git-ignoré.

import { existsSync } from 'node:fs'
import { spawn } from 'node:child_process'

const DATA_DIR = './.emulator-data'

// Le CLI Firebase exige Node >= 20.
const major = Number(process.versions.node.split('.')[0])
if (major < 20) {
  console.error(
    `\n✖ Node ${process.versions.node} détecté — le CLI Firebase exige Node >= 20.\n` +
      `  Lance d'abord :  nvm use   (un .nvmrc fixe la version à 22)\n`,
  )
  process.exit(1)
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
