export const DEFAULT_COACH_ID = "U2605e0037ceb7323dfa48dd80d6a86cc";

// Only legacy accounts without the field inherit Ray. Never restore a removed coach.
export function cooperatingCoachIds(data: { cooperatingCoachIds?: unknown }): string[] {
  if (data.cooperatingCoachIds === undefined) return [DEFAULT_COACH_ID];
  return Array.isArray(data.cooperatingCoachIds)
    ? [...new Set(data.cooperatingCoachIds.filter((id): id is string => typeof id === "string" && !!id))]
    : [];
}
