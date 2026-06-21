import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

let app;
let auth = null;
let db = null;

// Safe runtime detection block preventing build initialization reference exceptions
const getFirebaseConfig = () => {
  if (typeof window !== 'undefined' && window.__firebase_config) {
    try {
      return JSON.parse(window.__firebase_config);
    } catch (e) {
      console.error("Failed to parse window.__firebase_config", e);
    }
  }
  return null;
};

const config = getFirebaseConfig();

if (config) {
  app = getApps().length === 0 ? initializeApp(config) : getApps()[0];
  auth = getAuth(app);
  db = getFirestore(app);
}

export { app, auth, db, config };