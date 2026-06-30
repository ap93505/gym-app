import { Timestamp } from "firebase-admin/firestore";
import { db } from "@/lib/firebase/admin";

export async function coachReport(from: Date, to: Date) {
  const [snapshot, coaches] = await Promise.all([
    db.collection("sessions")
      .where("startAt", ">=", Timestamp.fromDate(from))
      .where("startAt", "<", Timestamp.fromDate(to))
      .orderBy("startAt", "asc")
      .get(),
    db.collection("users").where("roles", "array-contains", "coach").get(),
  ]);
  const rows = new Map<string, { coachId: string; coachName: string; completed: number; pending: number; notCompleted: number }>();
  coaches.docs.forEach((doc) => {
    const data = doc.data();
    rows.set(doc.id, {
      coachId: doc.id,
      coachName: data.realName || data.nickname || data.displayName || "教練",
      completed: 0,
      pending: 0,
      notCompleted: 0,
    });
  });
  const details: Array<{ id: string; coachId: string; coachName: string; studentName: string; startAt: string; endAt: string; status: string }> = [];
  const now = Date.now();
  snapshot.docs.forEach((doc) => {
    const data = doc.data();
    const row = rows.get(data.coachId) ?? { coachId: data.coachId, coachName: data.coachName, completed: 0, pending: 0, notCompleted: 0 };
    if (data.status === "completed") row.completed += 1;
    if (["scheduled", "checked_in"].includes(data.status) && data.endAt.toMillis() <= now) row.pending += 1;
    if (data.status === "not_completed") row.notCompleted += 1;
    rows.set(data.coachId, row);
    if (data.status !== "cancelled") {
      details.push({
        id: doc.id,
        coachId: data.coachId,
        coachName: data.coachName,
        studentName: data.studentName,
        startAt: data.startAt.toDate().toISOString(),
        endAt: data.endAt.toDate().toISOString(),
        status: data.status,
      });
    }
  });
  return {
    rows: [...rows.values()].sort((a, b) => b.completed - a.completed || a.coachName.localeCompare(b.coachName, "zh-TW")),
    details,
  };
}
