import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config();
// Attempt to parse service account JSON from env
let serviceAccount = null;
try {
    if (process.env.FIREBASE_PRIVATE_KEY) {
        serviceAccount = {
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
        };
    }
}
catch (error) {
    console.warn("Failed to parse Firebase service account from environment variables.");
}
if (serviceAccount && !getApps().length) {
    initializeApp({
        credential: cert(serviceAccount)
    });
}
export const verifyGoogleToken = async (idToken) => {
    if (!getApps().length) {
        throw new Error('Firebase Admin SDK is not initialized. Please configure FIREBASE_PRIVATE_KEY.');
    }
    return getAuth().verifyIdToken(idToken);
};
