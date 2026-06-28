import { z } from "zod";

const serverSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  LINE_CHANNEL_ID: z.string().min(1),
  LINE_CHANNEL_SECRET: z.string().min(1),
  SESSION_SECRET: z.string().min(32),
  INITIAL_ADMIN_LINE_USER_ID: z.string().optional(),
  GOOGLE_CLOUD_PROJECT: z.string().optional(),
  FIRESTORE_DATABASE_ID: z.string().default("(default)"),
});

export function getServerEnv() {
  const result = serverSchema.safeParse(process.env);
  if (!result.success) {
    throw new Error(`環境變數設定不完整：${result.error.issues.map((issue) => issue.path.join(".")).join(", ")}`);
  }
  return result.data;
}

export function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}
