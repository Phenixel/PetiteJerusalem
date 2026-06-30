// Import the functions you need from the SDKs you need
import { initializeApp } from 'firebase/app'
import { GoogleAuthProvider, getAuth, connectAuthEmulator } from 'firebase/auth'
import { getAnalytics } from 'firebase/analytics'
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore'

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: 'AIzaSyCykY9IonqmVpuA0VGICXnMWVtVNWlipnk',
  authDomain: 'petite-jerusalem.fr',
  projectId: 'petite-jerusalem-dev',
  storageBucket: 'petite-jerusalem-dev.firebasestorage.app',
  messagingSenderId: '152837353533',
  appId: '1:152837353533:web:f98a0d34a8c2e834d07a54',
  measurementId: 'G-YCXXL5PMK0',
}

export const googleAuthProvider = new GoogleAuthProvider()
googleAuthProvider.setCustomParameters({
  prompt: 'select_account',
})

// Initialize Firebase
export const app = initializeApp(firebaseConfig)

// Initialize Firestore
export const db = getFirestore(app)

// Initialize Auth
export const auth = getAuth(app)

// Connect to emulators in development.
// Plage de ports dédiée à ce projet (8470-8476) pour ne pas entrer en conflit
// avec d'autres projets Firebase tournant en parallèle (qui gardent les ports
// par défaut 8080 / 9099 …). À garder en phase avec le bloc "emulators" de firebase.json.
if (import.meta.env.DEV) {
  connectFirestoreEmulator(db, 'localhost', 8470)
  connectAuthEmulator(auth, 'http://localhost:8471', { disableWarnings: true })
}

// Initialize Analytics (prod only)
export const analytics = import.meta.env.PROD ? getAnalytics(app) : null
