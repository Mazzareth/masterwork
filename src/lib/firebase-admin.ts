import * as admin from 'firebase-admin';

/**
 * @description Initializes the Firebase Admin SDK if it hasn't been already.
 * @throws Will throw an error if the Firebase Admin SDK fails to initialize.
 */
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
  } catch (error) {
    console.error('Firebase admin initialization error', error);
  }
}

/**
 * @description Firebase Admin Authentication instance.
 */
export const auth = admin.auth();

/**
 * @description Firebase Admin Firestore instance.
 */
export const db = admin.firestore();