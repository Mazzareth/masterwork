import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Firebase config (provided)
const firebaseConfig = {
  apiKey: "AIzaSyAGqzBfhtt93kL4A3XsAq9ipjrTnsbb7QM",
  authDomain: "masterworkapp-qg9ri.firebaseapp.com",
  projectId: "masterworkapp-qg9ri",
  storageBucket: "masterworkapp-qg9ri.firebasestorage.app",
  messagingSenderId: "744876693801",
  appId: "1:744876693801:web:477acc7cdc07bc62867f38",
};

// Ensure single app instance (Next.js hot reload safe)
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Auth and Providers
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Firestore
export const db = getFirestore(app);

export default app;