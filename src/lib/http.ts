import { NextResponse } from "next/server";
import { AppError } from "./domain/errors";

export function apiError(error: unknown) {
  if (error instanceof AppError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message, details: error.details } },
      { status: error.status },
    );
  }
  console.error(error);
  return NextResponse.json(
    { error: { code: "INTERNAL_ERROR", message: "系統發生未預期錯誤" } },
    { status: 500 },
  );
}

export function serializeDocument<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => {
      if (item && typeof item === "object" && "toDate" in item && typeof item.toDate === "function") {
        return [key, item.toDate().toISOString()];
      }
      return [key, item];
    }),
  );
}
