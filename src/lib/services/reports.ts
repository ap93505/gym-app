import { Timestamp } from "firebase-admin/firestore";
import { db } from "@/lib/firebase/admin";

export async function coachReport(from: Date, to: Date) {
  const [snapshot, coaches, plans] = await Promise.all([
    db.collection("sessions")
      .where("startAt", ">=", Timestamp.fromDate(from))
      .where("startAt", "<", Timestamp.fromDate(to))
      .orderBy("startAt", "asc")
      .get(),
    db.collection("users").where("roles", "array-contains", "coach").get(),
    db.collection("plans").get(),
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
  const planMatrix = new Map<string, { planId: string; planName: string; price: number; byCoach: Record<string, number>; total: number }>();
  plans.docs.forEach((doc) => planMatrix.set(doc.id, { planId: doc.id, planName: doc.data().name ?? doc.id, price: Number(doc.data().price ?? 0), byCoach: {}, total: 0 }));
  const details: Array<{ id: string; coachId: string; coachName: string; studentName: string; planId: string; planName: string; startAt: string; endAt: string; status: string }> = [];
  const now = Date.now();
  snapshot.docs.forEach((doc) => {
    const data = doc.data();
    const row = rows.get(data.coachId) ?? { coachId: data.coachId, coachName: data.coachName, completed: 0, pending: 0, notCompleted: 0 };
    if (data.status === "completed") {
      row.completed += 1;
      const plan: { planId: string; planName: string; price: number; byCoach: Record<string, number>; total: number } = planMatrix.get(data.planId) ?? { planId: data.planId, planName: data.planName ?? data.planId, price: Number(data.planPrice ?? 0), byCoach: {}, total: 0 };
      plan.byCoach[data.coachId] = (plan.byCoach[data.coachId] ?? 0) + 1;
      plan.total += 1;
      planMatrix.set(data.planId, plan);
    }
    if (["scheduled", "checked_in"].includes(data.status) && data.endAt.toMillis() <= now) row.pending += 1;
    if (data.status === "not_completed") row.notCompleted += 1;
    rows.set(data.coachId, row);
    if (data.status !== "cancelled") {
      details.push({
        id: doc.id,
        coachId: data.coachId,
        coachName: data.coachName,
        studentName: data.studentName,
        planId: data.planId,
        planName: data.planName,
        startAt: data.startAt.toDate().toISOString(),
        endAt: data.endAt.toDate().toISOString(),
        status: data.status,
      });
    }
  });
  const sortedRows = [...rows.values()].sort((a, b) => b.completed - a.completed || a.coachName.localeCompare(b.coachName, "zh-TW"));
  return {
    rows: sortedRows,
    coachColumns: sortedRows.map(({ coachId, coachName }) => ({ coachId, coachName })),
    planRows: [...planMatrix.values()].sort((a, b) => a.planName.localeCompare(b.planName, "zh-TW")),
    details,
  };
}
