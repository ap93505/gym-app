export const DEFAULT_SLOT_CAPACITY = 4;
export const MAX_SLOT_CAPACITY = 100;

export function isValidSlotCapacity(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= MAX_SLOT_CAPACITY;
}

export function slotCapacityFromData(data: { slotCapacity?: unknown } | undefined) {
  return isValidSlotCapacity(data?.slotCapacity) ? data.slotCapacity : DEFAULT_SLOT_CAPACITY;
}

export function slotCapacityState(count: number, capacity: number) {
  return count >= capacity ? "full" : count === capacity - 1 ? "limited" : "available";
}
