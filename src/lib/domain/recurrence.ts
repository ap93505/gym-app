import { AppError } from "./errors";

export type RecurrenceFrequency = "none" | "daily" | "weekly" | "monthly";

export type RecurrenceRule = {
  frequency: RecurrenceFrequency;
  count?: number;
  endAt?: Date;
};

export const MAX_OCCURRENCES_PER_REQUEST = 100;

function addMonthsClamped(date: Date, months: number) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + months;
  const targetYear = year + Math.floor(month / 12);
  const targetMonth = ((month % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const day = Math.min(date.getUTCDate(), lastDay);
  return new Date(
    Date.UTC(
      targetYear,
      targetMonth,
      day,
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
      date.getUTCMilliseconds(),
    ),
  );
}

function occurrenceAt(start: Date, frequency: RecurrenceFrequency, index: number) {
  if (frequency === "none") return new Date(start);
  if (frequency === "monthly") return addMonthsClamped(start, index);
  const days = frequency === "daily" ? index : index * 7;
  return new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
}

export function generateOccurrences(start: Date, rule: RecurrenceRule): Date[] {
  if (Number.isNaN(start.getTime())) throw new AppError("課程開始時間無效");
  if (rule.frequency === "none") return [new Date(start)];
  if (!rule.count && !rule.endAt) throw new AppError("重複課程必須指定循環次數或結束日");
  if (rule.count !== undefined && (!Number.isInteger(rule.count) || rule.count < 1)) {
    throw new AppError("循環次數必須是正整數");
  }

  const occurrences: Date[] = [];
  for (let index = 0; index < MAX_OCCURRENCES_PER_REQUEST; index += 1) {
    const occurrence = occurrenceAt(start, rule.frequency, index);
    if (rule.count !== undefined && index >= rule.count) break;
    if (rule.endAt && occurrence > rule.endAt) break;
    occurrences.push(occurrence);
  }

  if (rule.count && rule.count > MAX_OCCURRENCES_PER_REQUEST) {
    throw new AppError(`單次最多建立 ${MAX_OCCURRENCES_PER_REQUEST} 堂課`);
  }
  if (occurrences.length === MAX_OCCURRENCES_PER_REQUEST && rule.endAt) {
    const next = occurrenceAt(start, rule.frequency, occurrences.length);
    if (next <= rule.endAt) throw new AppError(`單次最多建立 ${MAX_OCCURRENCES_PER_REQUEST} 堂課`);
  }
  if (occurrences.length === 0) throw new AppError("結束日不得早於第一堂課");
  return occurrences;
}

export function calculateEndAt(start: Date, frequency: RecurrenceFrequency, count: number) {
  if (!Number.isInteger(count) || count < 1) throw new AppError("循環次數必須是正整數");
  return occurrenceAt(start, frequency, count - 1);
}
