import { parseArgs } from "node:util";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { config } from "dotenv";
import { applicationDefault, initializeApp } from "firebase-admin/app";
import { FieldValue, GeoPoint, Timestamp, DocumentReference, getFirestore, type QuerySnapshot, type Transaction } from "firebase-admin/firestore";

config({ path: [".env.local", ".env"], quiet: true });
const { values } = parseArgs({ options: {
  project: { type: "string" }, database: { type: "string" }, apply: { type: "boolean", default: false },
} });
const projectId = process.env.GOOGLE_CLOUD_PROJECT;
const databaseId = process.env.FIRESTORE_DATABASE_ID ?? "(default)";
if (!values.project || !values.database || values.project !== projectId || values.database !== databaseId) {
  throw new Error("Pass --project and --database matching the configured target. No data changed.");
}
if (process.env.FIRESTORE_EMULATOR_HOST) throw new Error("This command targets the configured cloud database, not an emulator.");
const db = getFirestore(initializeApp({ credential: applicationDefault(), projectId }), databaseId);
const courseCollections = ["sessions", "recurrenceSeries", "timeSlots", "coachSlotLocks", "studentSlotLocks", "creditLedgers", "creditGrantRequests"];
const names = [...courseCollections, "users", "plans", "settings", "auditLogs", "creditBatches"];
const queries = names.map((name) => name === "creditBatches" ? db.collectionGroup(name) : db.collection(name));

function isCourseAudit(data: FirebaseFirestore.DocumentData) {
  const action = String(data.action ?? "");
  return /^(session|sessions|credits)\./.test(action) || action === "maintenance.bookings_and_credits_reset";
}

// Tagged values preserve Firestore types in the local recovery snapshot.
function encode(value: unknown): unknown {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : { $type: "number", value: String(value) };
  if (value instanceof Timestamp) return { $type: "timestamp", seconds: value.seconds, nanoseconds: value.nanoseconds };
  if (value instanceof GeoPoint) return { $type: "geopoint", latitude: value.latitude, longitude: value.longitude };
  if (value instanceof DocumentReference) return { $type: "reference", path: value.path };
  if (Buffer.isBuffer(value)) return { $type: "bytes", base64: value.toString("base64") };
  if (Array.isArray(value)) return { $type: "array", values: value.map(encode) };
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    return { $type: "map", fields: Object.fromEntries(Object.entries(value).map(([key, item]) => [key, encode(item)])) };
  }
  throw new Error("Unsupported backup value; stopping before deletion.");
}

async function readState(tx: Transaction) {
  return Promise.all(queries.map((query) => tx.get(query)));
}

function fingerprint(snapshots: QuerySnapshot[]) {
  return snapshots.map((snapshot) => snapshot.docs.map((doc) => `${doc.ref.path}:${doc.updateTime.seconds}:${doc.updateTime.nanoseconds}`).sort().join("\n")).join("\n---\n");
}

async function main() {
  const before = await db.runTransaction(readState, { readOnly: true });
  const byName = Object.fromEntries(names.map((name, i) => [name, before[i]]));
  const batches = byName.creditBatches.docs;
  if (batches.some((doc) => !/^users\/[^/]+\/creditBatches\/[^/]+$/.test(doc.ref.path))) {
    throw new Error("Unexpected credit batch path; no changes made.");
  }
  const courseAudits = byName.auditLogs.docs.filter((doc) => isCourseAudit(doc.data()));
  const targets = [...courseCollections.flatMap((name) => byName[name].docs), ...batches, ...courseAudits];
  // Do not leave nested data behind when deleting a document.
  for (const doc of targets) {
    if ((await doc.ref.listCollections()).length) throw new Error(`Unexpected nested collection at ${doc.ref.path}; no changes made.`);
  }
  const summary = {
    projectId, databaseId,
    deleted: { ...Object.fromEntries(courseCollections.map((name) => [name, byName[name].size])), creditBatches: batches.length, courseAuditLogs: courseAudits.length },
    usersReset: byName.users.size, plansPreserved: byName.plans.size,
    settingsPreserved: byName.settings.size, otherAuditLogsPreserved: byName.auditLogs.size - courseAudits.length,
  };
  console.log(JSON.stringify({ mode: values.apply ? "apply" : "dry-run", ...summary }, null, 2));
  if (!values.apply) return;
  if (targets.length + byName.users.size + 1 > 500) throw new Error("Too many writes for this single atomic reset; no changes made.");

  const backupDirectory = resolve("backups");
  await mkdir(backupDirectory, { recursive: true });
  const backupPath = resolve(backupDirectory, `course-reset-${projectId}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  await writeFile(backupPath, JSON.stringify({
    format: "ray-firestore-tagged-v1", projectId, databaseId, createdAt: new Date().toISOString(),
    documents: before.flatMap((snapshot) => snapshot.docs.map((doc) => ({ path: doc.ref.path, data: encode(doc.data()) }))),
  }, null, 2), { flag: "wx" });
  console.log(`Backup saved: ${backupPath}`);

  const auditRef = db.collection("auditLogs").doc();
  await db.runTransaction(async (tx) => {
    const current = await readState(tx);
    if (fingerprint(current) !== fingerprint(before)) {
      throw new Error("Database changed since backup; aborted without deleting anything. Retry during an idle period.");
    }
    for (const doc of targets) tx.delete(doc.ref);
    for (const user of byName.users.docs) tx.update(user.ref, {
      credits: { totalRemaining: 0, reserved: 0 },
      sharedCreditBatchPaths: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp(),
    });
    tx.set(auditRef, {
      action: "maintenance.bookings_and_credits_reset", actorId: "maintenance-script",
      metadata: summary, createdAt: FieldValue.serverTimestamp(),
    });
  });

  const after = await db.runTransaction(readState, { readOnly: true });
  const afterByName = Object.fromEntries(names.map((name, i) => [name, after[i]]));
  for (const name of [...courseCollections, "creditBatches"]) {
    if (!afterByName[name].empty) throw new Error(`Reset committed, but verification found remaining/new documents in ${name}.`);
  }
  for (const name of ["plans", "settings"]) {
    if (fingerprint([byName[name]]) !== fingerprint([afterByName[name]])) throw new Error(`Reset committed, but ${name} changed during verification.`);
  }
  const afterUsers = new Map(afterByName.users.docs.map((doc) => [doc.id, doc.data()]));
  if (afterUsers.size !== byName.users.size) throw new Error("Reset committed, but account count changed during verification.");
  for (const user of byName.users.docs) {
    const actual = afterUsers.get(user.id);
    if (!actual || actual.credits?.totalRemaining !== 0 || actual.credits?.reserved !== 0 || "sharedCreditBatchPaths" in actual) {
      throw new Error("Reset committed, but account credit verification failed.");
    }
    const strip = (data: FirebaseFirestore.DocumentData) => Object.fromEntries(Object.entries(data).filter(([key]) => !["credits", "sharedCreditBatchPaths", "updatedAt"].includes(key)).sort(([a], [b]) => a.localeCompare(b)));
    if (JSON.stringify(encode(strip(user.data()))) !== JSON.stringify(encode(strip(actual)))) throw new Error("Reset committed, but account profile/role verification failed.");
  }
  const remainingOldCourseAudits = afterByName.auditLogs.docs.filter((doc) => doc.id !== auditRef.id && isCourseAudit(doc.data()));
  if (remainingOldCourseAudits.length) throw new Error("Reset committed, but new course audit records appeared during verification.");
  console.log(JSON.stringify({ verified: true, ...summary, backupPath }, null, 2));
}

main().catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }).finally(() => db.terminate());
