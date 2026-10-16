require('dotenv').config();

const { cert, initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
const missingFields = [
  ['FIREBASE_PROJECT_ID', projectId],
  ['FIREBASE_CLIENT_EMAIL', clientEmail],
  ['FIREBASE_PRIVATE_KEY', privateKey]
]
  .filter(([, value]) => !value)
  .map(([name]) => name);

if (missingFields.length > 0) {
  throw new Error(`Missing Firebase credentials: ${missingFields.join(', ')}`);
}

const app = initializeApp({
  credential: cert({ projectId, clientEmail, privateKey })
});

const db = getFirestore(app);

module.exports = { app, db };
