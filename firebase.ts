// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { GoogleAuthProvider } from 'firebase/auth'

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCykY9IonqmVpuA0VGICXnMWVtVNWlipnk",
  authDomain: "petite-jerusalem-dev.firebaseapp.com",
  projectId: "petite-jerusalem-dev",
  storageBucket: "petite-jerusalem-dev.firebasestorage.app",
  messagingSenderId: "152837353533",
  appId: "1:152837353533:web:f98a0d34a8c2e834d07a54"
};

export const googleAuthProvider = new GoogleAuthProvider()
  googleAuthProvider.setCustomParameters({
    prompt: 'select_account',
  })

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
