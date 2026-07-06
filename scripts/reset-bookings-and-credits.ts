import { config } from "dotenv";
import { FieldValue } from "firebase-admin/firestore";

config({ path: [".env.local", ".env"] });

async function main() {
  const { db } = await import("../src/lib/firebase/admin");
  const collections = [
    "sessions",
    "recurrenceSeries",
    "timeSlots",
    "coachSlotLocks",
    "studentSlotLocks",
    "creditLedgers",
  ];

  const deleted: Record<string, number> = {};
  for (const name of collections) {
    const ref = db.collection(name);
    const snapshot = await ref.get();
    deleted[name] = snapshot.size;
    await db.recursiveDelete(ref);
  }

  const users = await db.collection("users").get();
  let creditBatches = 0;
  for (const user of users.docs) {
    const batches = user.ref.collection("creditBatches");
    const snapshot = await batches.get();
    creditBatches += snapshot.size;
    await db.recursiveDelete(batches);
    await user.ref.update({
      credits: { totalRemaining: 0, reserved: 0 },
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  await db.collection("auditLogs").add({
    action: "maintenance.bookings_and_credits_reset",
    actorId: "maintenance-script",
    metadata: { ...deleted, creditBatches, usersReset: users.size },
    createdAt: FieldValue.serverTimestamp(),
  });

  console.log(JSON.stringify({ projectId: process.env.GOOGLE_CLOUD_PROJECT, databaseId: process.env.FIRESTORE_DATABASE_ID ?? "(default)", deleted: { ...deleted, creditBatches }, usersReset: users.size }, null, 2));
}

void main();
