import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

type LogLevel = "log" | "warn" | "error";

export function writeOperationalLog(level: LogLevel, payload: Record<string, unknown>) {
  const entry = {
    level,
    timestamp: new Date().toISOString(),
    ...payload
  };
  const line = JSON.stringify(entry);

  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }

  const logFilePath = process.env.LOG_FILE_PATH;
  if (!logFilePath) {
    return;
  }

  try {
    mkdirSync(dirname(logFilePath), { recursive: true });
    appendFileSync(logFilePath, `${line}\n`, { encoding: "utf8" });
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        timestamp: new Date().toISOString(),
        type: "log_write_failed",
        message: error instanceof Error ? error.message : "Unknown log write error"
      })
    );
  }
}
