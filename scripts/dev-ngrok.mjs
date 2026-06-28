import { spawn } from "node:child_process";
import process from "node:process";
import { config } from "dotenv";
import ngrok from "@ngrok/ngrok";

config({ path: ".env.local", quiet: true });

const port = Number(process.env.PORT ?? 3000);
const authtoken = process.env.NGROK_AUTHTOKEN?.trim();
const domain = process.env.NGROK_DOMAIN?.trim();

if (!authtoken) {
  console.error("\n缺少 NGROK_AUTHTOKEN。請從 https://dashboard.ngrok.com/get-started/your-authtoken 取得並填入 .env.local。\n");
  process.exit(1);
}

let listener;
let child;
let shuttingDown = false;

async function closeTunnel() {
  if (listener) {
    await listener.close().catch(() => undefined);
    listener = undefined;
  }
}

async function shutdown(signal = "SIGTERM") {
  if (shuttingDown) return;
  shuttingDown = true;
  if (child && !child.killed) child.kill(signal);
  await closeTunnel();
}

async function waitForLocalServer(url, timeoutMs = 60_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1_000) });
      if (response.ok) return;
    } catch {
      // The Next.js development server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error("Next.js 在 60 秒內沒有啟動完成");
}

try {
  listener = await ngrok.forward({
    addr: port,
    authtoken,
    ...(domain ? { domain } : {}),
  });
  const publicUrl = listener.url();
  if (!publicUrl) throw new Error("ngrok 沒有回傳公開網址");

  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  child = spawn(npmCommand, ["run", "dev", "--", "--port", String(port)], {
    env: { ...process.env, NEXT_PUBLIC_APP_URL: publicUrl, PORT: String(port) },
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  child.once("exit", async (code) => {
    if (shuttingDown) return;
    shuttingDown = true;
    await closeTunnel();
    process.exitCode = code ?? 0;
  });

  await waitForLocalServer(`http://127.0.0.1:${port}/api/health`);
  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RAY Fitness 本機測試已啟動

公開網址        ${publicUrl}
LINE Callback   ${publicUrl}/api/auth/line/callback
帳號資訊選單    ${publicUrl}/api/auth/line/start?returnTo=/member/account
打卡上課選單    ${publicUrl}/api/auth/line/start?returnTo=/member/check-in

請將 LINE Callback 登記到 LINE Developers Console。
按 Ctrl+C 可同時停止 Next.js 與 ngrok。
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
} catch (error) {
  console.error("\nngrok 本機測試啟動失敗：", error instanceof Error ? error.message : error);
  await shutdown();
  process.exitCode = 1;
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));
