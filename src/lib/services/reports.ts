import { Timestamp } from "firebase-admin/firestore";
import { db } from "@/lib/firebase/admin";

export async function coachReport(from: Date, to: Date) {
  const snapshot = await db.collection("sessions")
    .where("startAt", ">=", Timestamp.fromDate(from))
    .where("startAt", "<", Timestamp.fromDate(to))
    .orderBy("startAt", "asc")
    .get();
  const rows = new Map<string, { coachId: string; coachName: string; completed: number; notCompleted: number; noShow: number }>();
  snapshot.docs.forEach((doc) => {
    const data = doc.data();
    const row = rows.get(data.coachId) ?? { coachId: data.coachId, coachName: data.coachName, completed: 0, notCompleted: 0, noShow: 0 };
    if (data.status === "completed") row.completed += 1;
    if (data.status === "not_completed") row.notCompleted += 1;
    if (data.status === "not_completed" && data.incompleteReason === "student_no_show") row.noShow += 1;
    rows.set(data.coachId, row);
  });
  return [...rows.values()].sort((a, b) => b.completed - a.completed);
}
