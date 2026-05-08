/**
 * Structured logger for TreeforAmbition backend (Medusa.js).
 *
 * Uses pino with pretty-printing in development for readable console output.
 * In production, emits raw JSON for log aggregation.
 */

const isDev = process.env.NODE_ENV === "development";

// ---------------------------------------------------------------------------
// Lazy-initialised pino instance
// ---------------------------------------------------------------------------
let _pinoLogger: ReturnType<typeof import("pino").default> | null = null;

function getPinoLogger() {
  if (!_pinoLogger) {
    try {
      const pino = require("pino") as typeof import("pino");
      _pinoLogger = (pino.default ?? pino)({
        level: isDev ? "debug" : "info",
        ...(isDev
          ? {
              transport: {
                target: "pino-pretty",
                options: { colorize: true, translateTime: "HH:MM:ss.l" },
              },
            }
          : {}),
        base: undefined,
      });
    } catch {
      _pinoLogger = null;
    }
  }
  return _pinoLogger;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type LogEntry = {
  ts: string;
  level: "info" | "warn" | "error" | "debug";
  module: string;
  operation: string;
  phase?: "start" | "response" | "error" | string;
  duration?: number;
  message?: string;
  [key: string]: unknown;
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create a namespaced logger for a specific module.
 */
export function createLogger(module: string) {
  function emit(level: LogEntry["level"], extra: Omit<LogEntry, "ts" | "level" | "module">) {
    const entry: LogEntry = {
      ts: new Date().toISOString(),
      level,
      module,
      ...extra,
    };

    const p = getPinoLogger();
    if (p) {
      const { ts, ...rest } = entry;
      p[level === "debug" ? "debug" : level === "warn" ? "warn" : level === "error" ? "error" : "info"](rest);
      return;
    }

    // Fallback
    const payload = JSON.stringify(entry);
    if (level === "error") console.error(payload);
    else if (level === "warn") console.warn(payload);
    else console.log(payload);
  }

  return {
    info: (extra: Omit<LogEntry, "ts" | "level" | "module">) => emit("info", extra),
    warn: (extra: Omit<LogEntry, "ts" | "level" | "module">) => emit("warn", extra),
    error: (extra: Omit<LogEntry, "ts" | "level" | "module">) => emit("error", extra),
    debug: (extra: Omit<LogEntry, "ts" | "level" | "module">) => emit("debug", extra),
  };
}

export const logger = createLogger("backend");

/**
 * Wrap an async function with timing + start/response/error logging.
 */
export async function withTiming<T>(
  module: string,
  operation: string,
  fn: () => Promise<T>,
  extra?: Record<string, unknown>,
): Promise<T> {
  const log = createLogger(module);
  const t0 = Date.now();
  log.info({ operation, phase: "start", ...extra });
  try {
    const result = await fn();
    log.info({ operation, phase: "response", duration: Date.now() - t0, ...extra });
    return result;
  } catch (error) {
    log.error({
      operation,
      phase: "error",
      duration: Date.now() - t0,
      message: error instanceof Error ? error.message : String(error),
      ...extra,
    });
    throw error;
  }
}

/**
 * Log a Medusa query.graph() call.
 */
export function logDbQuery(params: {
  module: string;
  entity: string;
  operation: string;
  duration: number;
  filterKeys?: string[];
  resultCount?: number;
  error?: unknown;
}) {
  const log = createLogger(params.module);
  if (params.error) {
    log.error({
      operation: `db:${params.operation}`,
      entity: params.entity,
      duration: params.duration,
      filterKeys: params.filterKeys,
      message: params.error instanceof Error ? params.error.message : String(params.error),
    });
  } else {
    log.info({
      operation: `db:${params.operation}`,
      entity: params.entity,
      duration: params.duration,
      filterKeys: params.filterKeys,
      resultCount: params.resultCount,
    });
  }
}

/**
 * Log an external API call.
 */
export function logApiCall(params: {
  module: string;
  method: string;
  url: string;
  duration: number;
  status?: number;
  error?: unknown;
}) {
  const log = createLogger(params.module);
  if (params.error) {
    log.error({
      operation: "api-call",
      method: params.method,
      url: params.url,
      duration: params.duration,
      message: params.error instanceof Error ? params.error.message : String(params.error),
    });
  } else {
    log.info({
      operation: "api-call",
      method: params.method,
      url: params.url,
      duration: params.duration,
      status: params.status,
    });
  }
}
