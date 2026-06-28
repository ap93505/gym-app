import { applicationDefault, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

type FirebaseAdminGlobal = typeof globalThis & {
  __rayFirebaseAdminApp?: App;
  __rayFirestore?: Firestore;
};

const globalForFirebase = globalThis as FirebaseAdminGlobal;
const databaseId = process.env.FIRESTORE_DATABASE_ID ?? "(default)";

const app =
  globalForFirebase.__rayFirebaseAdminApp ??
  getApps()[0] ??
  initializeApp({
    credential: applicationDefault(),
    projectId: process.env.GOOGLE_CLOUD_PROJECT,
  });

function createFirestore() {
  const instance = getFirestore(app, databaseId);
  try {
    instance.settings({ ignoreUndefinedProperties: true });
  } catch (error) {
    // During a Next.js hot reload the Admin app can survive while this module is
    // evaluated again. In that case settings were already applied on first use.
    if (error instanceof Error && error.message.includes("already been initialized")) {
      return instance;
    }
    throw error;
  }
  return instance;
}

globalForFirebase.__rayFirebaseAdminApp = app;
export const db = globalForFirebase.__rayFirestore ?? createFirestore();
globalForFirebase.__rayFirestore = db;
