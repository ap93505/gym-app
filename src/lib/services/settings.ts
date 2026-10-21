import { FieldValue } from "firebase-admin/firestore";
import { db } from "@/lib/firebase/admin";
import { assert } from "@/lib/domain/errors";
import { isValidSlotCapacity, MAX_SLOT_CAPACITY, slotCapacityFromData } from "@/lib/domain/scheduling";
import type { SessionPrincipal } from "@/lib/domain/types";

export function schedulingSettingsRef() {
  return db.collection("settings").doc("scheduling");
}

export async function getSchedulingSettings() {
  const snapshot = await schedulingSettingsRef().get();
  return { slotCapacity: slotCapacityFromData(snapshot.data()) };
}

export async function updateSchedulingSettings(principal: SessionPrincipal, slotCapacity: number) {
  assert(principal.roles.includes("admin"), "只有管理者可以修改預約設定", 403, "FORBIDDEN");
  assert(isValidSlotCapacity(slotCapacity), `同時段課程上限必須為 1 至 ${MAX_SLOT_CAPACITY} 的整數`);
  await db.runTransaction(async (tx) => {
    const ref = schedulingSettingsRef();
    const snapshot = await tx.get(ref);
    const previousCapacity = slotCapacityFromData(snapshot.data());
    tx.set(ref, { ...snapshot.data(), slotCapacity, updatedBy: principal.userId, updatedAt: FieldValue.serverTimestamp() });
    tx.set(db.collection("auditLogs").doc(), {
      action: "settings.scheduling_updated", actorId: principal.userId, targetId: ref.path,
      metadata: { previousCapacity, slotCapacity }, createdAt: FieldValue.serverTimestamp(),
    });
  });
  return { slotCapacity };
}
