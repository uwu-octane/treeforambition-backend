/**
 * Centralised, typed environment configuration.
 *
 * Every env var the backend consumes is declared exactly once here.
 * No other file reads process.env directly — import from this module instead.
 *
 * Rules:
 * - Required vars: throw in production, console.warn + empty string in dev
 * - Optional vars: console.warn if missing, use the declared fallback
 * - Deduplicated: COS_* aliases are mapped to MEDUSA_FILE_* (Medusa canonical names)
 */

import { loadEnv } from "@medusajs/framework/utils";

loadEnv(process.env.NODE_ENV || "development", process.cwd());

// ---------------------------------------------------------------------------
// Runtime environment
// ---------------------------------------------------------------------------

export const NODE_ENV = optional("NODE_ENV", "development");
const isDev = NODE_ENV === "development";

function required(key: string): string {
  const value = process.env[key];
  if (value !== undefined && value !== "") return value;
  const msg = `Missing required env var: ${key}`;
  if (isDev) {
    console.warn(`[env] ${msg} — bypassing in dev mode`);
    return "";
  }
  throw new Error(`[env] ${msg}`);
}

function optional(key: string, fallback: string = ""): string {
  const value = process.env[key];
  if (value === undefined || value === "") {
    if (!fallback) console.warn(`[env] Missing optional env var: ${key}`);
    return fallback;
  }
  return value;
}

// ---------------------------------------------------------------------------
// Database & Redis
// ---------------------------------------------------------------------------

export const DATABASE_URL = required("DATABASE_URL");
export const REDIS_URL = required("REDIS_URL");

// ---------------------------------------------------------------------------
// HTTP / Auth
// ---------------------------------------------------------------------------

export const STORE_CORS = required("STORE_CORS");
export const ADMIN_CORS = required("ADMIN_CORS");
export const AUTH_CORS = required("AUTH_CORS");
export const JWT_SECRET = required("JWT_SECRET");
export const COOKIE_SECRET = required("COOKIE_SECRET");
export const WORKER_MODE = optional("WORKER_MODE", "shared") as "shared" | "worker" | "server";

// ---------------------------------------------------------------------------
// File storage (S3 / Tencent COS)
// ---------------------------------------------------------------------------

export const MEDUSA_FILE_URL = required("MEDUSA_FILE_URL");
export const MEDUSA_FILE_ACCESS_KEY_ID = required("MEDUSA_FILE_ACCESS_KEY_ID");
export const MEDUSA_FILE_SECRET_ACCESS_KEY = required("MEDUSA_FILE_SECRET_ACCESS_KEY");
export const MEDUSA_FILE_REGION = required("MEDUSA_FILE_REGION");
export const MEDUSA_FILE_BUCKET = required("MEDUSA_FILE_BUCKET");
export const MEDUSA_FILE_ENDPOINT = required("MEDUSA_FILE_ENDPOINT");
export const MEDUSA_FILE_PREFIX = optional("MEDUSA_FILE_PREFIX", "products/");

// ---- COS aliases (deduplicated — same values, used by other tooling) ----

export const COS_CDN_BASE_URL = MEDUSA_FILE_URL;
export const COS_SECRET_ID = MEDUSA_FILE_ACCESS_KEY_ID;
export const COS_SECRET_KEY = MEDUSA_FILE_SECRET_ACCESS_KEY;
export const COS_BUCKET = MEDUSA_FILE_BUCKET;
export const COS_REGION = MEDUSA_FILE_REGION;
export const COS_ENDPOINT = MEDUSA_FILE_ENDPOINT;

// ---------------------------------------------------------------------------
// Runtime / preview
// ---------------------------------------------------------------------------

export const TFB_RUNTIME_ENV = optional("TFB_RUNTIME_ENV");
export const PREVIEW_PAYMENT_MODE = optional("PREVIEW_PAYMENT_MODE");
export const PREVIEW_ACCESS_TOKEN = optional("PREVIEW_ACCESS_TOKEN");
export const PREVIEW_LOGIN_SECRET = optional("PREVIEW_LOGIN_SECRET", PREVIEW_ACCESS_TOKEN);

// ---------------------------------------------------------------------------
// Email (Resend)
// ---------------------------------------------------------------------------

export const RESEND_API_KEY = optional("RESEND_API_KEY");
export const RESEND_FROM_ADDRESS = optional("RESEND_FROM_ADDRESS", "noreply@treeparis.com");
export const RESEND_FROM_NAME = optional("RESEND_FROM_NAME", "Tree Paris");
export const PRODUCT_ALERT_NOTIFY_TO = optional("PRODUCT_ALERT_NOTIFY_TO");
export const HOME_PUBLISHING_NOTIFY_TO = optional("HOME_PUBLISHING_NOTIFY_TO");
export const PRODUCT_ALERT_EMAILS_ENABLED = optional("PRODUCT_ALERT_EMAILS_ENABLED") === "true";

// ---------------------------------------------------------------------------
// Product data source
// ---------------------------------------------------------------------------

export const DEV_SITE_PRODUCT_DATA_SOURCE = optional("DEV_SITE_PRODUCT_DATA_SOURCE");

// ---------------------------------------------------------------------------
// Notion
// ---------------------------------------------------------------------------

export const NOTION_POSTS_DATA_SOURCE_ID = optional("NOTION_POSTS_DATA_SOURCE_ID");
export const NOTION_TOKEN = optional("NOTION_TOKEN");
export const NOTION_WEBHOOK_SECRET = optional("NOTION_WEBHOOK_SECRET");

// ---------------------------------------------------------------------------
// WeChat (keep all separate — intentional)
// ---------------------------------------------------------------------------

export const WECHAT_API_BASE = optional("WECHAT_API_BASE", "https://api.weixin.qq.com");

// 微信服务号
export const WECHAT_SERVICE_APP_ID = optional("WECHAT_SERVICE_APP_ID");
export const WECHAT_SERVICE_APP_SECRET = optional("WECHAT_SERVICE_APP_SECRET");
export const WECHAT_SERVICE_LOGIN_REDIRECT_URL = optional("WECHAT_SERVICE_LOGIN_REDIRECT_URL");

// 微信开放平台
export const WECHAT_OPEN_APP_ID = optional("WECHAT_OPEN_APP_ID");
export const WECHAT_OPEN_APP_SECRET = optional("WECHAT_OPEN_APP_SECRET");
export const WECHAT_CALLBACK_DOMAIN = optional("WECHAT_CALLBACK_DOMAIN");

// 微信公众号
export const WECHAT_APP_ID = optional("WECHAT_APP_ID");
export const WECHAT_APP_SECRET = optional("WECHAT_APP_SECRET");

// 微信小程序
export const WECHAT_MINIAPP_ID = optional("WECHAT_MINIAPP_ID");

// 微信支付
export const WECHAT_PAY_MCH_ID = optional("WECHAT_PAY_MCH_ID");
export const WECHAT_PAY_APP_ID = optional("WECHAT_PAY_APP_ID");
export const WECHAT_PAY_PUB_KEY_ID = optional("WECHAT_PAY_PUB_KEY_ID");
export const WECHAT_PAY_NOTIFY_URL = optional("WECHAT_PAY_NOTIFY_URL");
export const WECHAT_PAY_API_V3_KEY = optional("WECHAT_PAY_API_V3_KEY");
export const WECHAT_PAY_MERCHANT_SERIAL_NO = optional("WECHAT_PAY_MERCHANT_SERIAL_NO");
export const WECHAT_PAY_PRIVATE_KEY_PEM = optional("WECHAT_PAY_PRIVATE_KEY_PEM");
export const WECHAT_PAY_PUBLIC_KEY_PEM = optional("WECHAT_PAY_PUBLIC_KEY_PEM");

// ---------------------------------------------------------------------------
// Test / migration (scripts only, not used at runtime)
// ---------------------------------------------------------------------------

const DEFAULT_TEST_CUSTOMER_EMAIL = "preview-test@customer.treeforambition.local";
const DEFAULT_TEST_CUSTOMER_PASSWORD = "preview-test-password-123";

export const SUPABASE_DATA_FILE = optional("SUPABASE_DATA_FILE");
export const DRY_RUN = optional("DRY_RUN");
export const SKIP_TABLES = optional("SKIP_TABLES");
export const TEST_CUSTOMER_EMAIL =
  optional("TEST_CUSTOMER_EMAIL") ||
  optional("PREVIEW_TEST_CUSTOMER_EMAIL") ||
  (isDev ? DEFAULT_TEST_CUSTOMER_EMAIL : "");
export const TEST_CUSTOMER_PASSWORD =
  optional("TEST_CUSTOMER_PASSWORD") ||
  optional("PREVIEW_TEST_CUSTOMER_PASSWORD") ||
  (isDev ? DEFAULT_TEST_CUSTOMER_PASSWORD : "");

// ---------------------------------------------------------------------------
// Backend URL (used internally for self-referencing HTTP calls)
// ---------------------------------------------------------------------------

export const MEDUSA_BACKEND_URL = optional("MEDUSA_BACKEND_URL", "http://localhost:9000");

// ---------------------------------------------------------------------------
// Validation summary (logged once at startup)
// ---------------------------------------------------------------------------

export function logEnvSummary() {
  const vars: Array<{ key: string; value: string; source: "required" | "optional" }> = [
    { key: "DATABASE_URL", value: DATABASE_URL ? "***" : "MISSING", source: "required" },
    { key: "REDIS_URL", value: REDIS_URL ? "***" : "MISSING", source: "required" },
    { key: "STORE_CORS", value: STORE_CORS, source: "required" },
    { key: "ADMIN_CORS", value: ADMIN_CORS, source: "required" },
    { key: "AUTH_CORS", value: AUTH_CORS, source: "required" },
    { key: "JWT_SECRET", value: JWT_SECRET ? "***" : "MISSING", source: "required" },
    { key: "COOKIE_SECRET", value: COOKIE_SECRET ? "***" : "MISSING", source: "required" },
    { key: "MEDUSA_FILE_URL", value: MEDUSA_FILE_URL, source: "required" },
    { key: "MEDUSA_FILE_ACCESS_KEY_ID", value: MEDUSA_FILE_ACCESS_KEY_ID ? "***" : "MISSING", source: "required" },
    { key: "MEDUSA_FILE_SECRET_ACCESS_KEY", value: MEDUSA_FILE_SECRET_ACCESS_KEY ? "***" : "MISSING", source: "required" },
    { key: "MEDUSA_FILE_REGION", value: MEDUSA_FILE_REGION, source: "required" },
    { key: "MEDUSA_FILE_BUCKET", value: MEDUSA_FILE_BUCKET, source: "required" },
    { key: "MEDUSA_FILE_ENDPOINT", value: MEDUSA_FILE_ENDPOINT, source: "required" },
    { key: "MEDUSA_FILE_PREFIX", value: MEDUSA_FILE_PREFIX, source: "optional" },
    { key: "WORKER_MODE", value: WORKER_MODE, source: "optional" },
    { key: "TFB_RUNTIME_ENV", value: TFB_RUNTIME_ENV || "(unset)", source: "optional" },
    { key: "PREVIEW_PAYMENT_MODE", value: PREVIEW_PAYMENT_MODE || "(unset)", source: "optional" },
    { key: "PREVIEW_LOGIN_SECRET", value: PREVIEW_LOGIN_SECRET ? "***" : "(unset)", source: "optional" },
    { key: "RESEND_API_KEY", value: RESEND_API_KEY ? "***" : "(unset)", source: "optional" },
    { key: "NOTION_TOKEN", value: NOTION_TOKEN ? "***" : "(unset)", source: "optional" },
    { key: "WECHAT_SERVICE_APP_ID", value: WECHAT_SERVICE_APP_ID || "(unset)", source: "optional" },
    { key: "WECHAT_PAY_MCH_ID", value: WECHAT_PAY_MCH_ID || "(unset)", source: "optional" },
  ];

  const missing = vars.filter((v) => v.value === "MISSING" && v.source === "required");
  const missingOptional = vars.filter((v) => v.value === "(unset)" && v.source === "optional");

  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      module: "env",
      operation: "startup",
      phase: "summary",
      requiredCount: vars.filter((v) => v.source === "required").length,
      optionalCount: vars.filter((v) => v.source === "optional").length,
      missingRequired: missing.map((v) => v.key),
      missingOptional: missingOptional.map((v) => v.key),
    }),
  );

  if (missing.length > 0 && !isDev) {
    throw new Error(`[env] Missing required vars: ${missing.map((v) => v.key).join(", ")}`);
  }
}
