import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { createHmac, timingSafeEqual } from "node:crypto"
import { z } from "zod"
import { APP_MODE, IS_NON_PRODUCTION_APP_MODE, MEDUSA_BACKEND_URL, PREVIEW_LOGIN_SECRET, PREVIEW_LOGIN_REQUIRE_SIGNATURE, TEST_CUSTOMER_EMAIL, TEST_CUSTOMER_PASSWORD, isEnabledEnvValue } from "../../../lib/env"

const log = (entry: Record<string, unknown>) => {
  console.log(JSON.stringify({ ts: new Date().toISOString(), ...entry }))
}

export const PreviewLoginSchema = z.object({
  returnTo: z.string().optional(),
})

export type PreviewLoginRequest = z.infer<typeof PreviewLoginSchema>

type JsonBody = Record<string, unknown>

const normalizeString = (value: unknown) => {
  if (typeof value !== "string") {
    return undefined
  }

  const normalized = value.trim()
  return normalized || undefined
}

const readTestCustomerCredentials = () => {
  const email = normalizeString(TEST_CUSTOMER_EMAIL)
  const password = normalizeString(TEST_CUSTOMER_PASSWORD)

  if (!email || !password) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Preview test customer credentials are not configured")
  }

  return { email, password }
}

const isNonProductionTestLoginEnabled = () => IS_NON_PRODUCTION_APP_MODE

const PREVIEW_LOGIN_SIGNATURE_MAX_AGE_MS = 5 * 60 * 1000

const requiresPreviewLoginSignature = () => isEnabledEnvValue(PREVIEW_LOGIN_REQUIRE_SIGNATURE)

const safeEqual = (left: string, right: string) => {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
}

const readHeaderValue = (value: string | string[] | undefined) => (Array.isArray(value) ? normalizeString(value[0]) : normalizeString(value))

const buildPreviewLoginSignaturePayload = ({ returnTo, timestamp }: { returnTo?: string; timestamp: string }) => `${timestamp}.${returnTo ?? ""}`

const createPreviewLoginSignature = ({ returnTo, secret, timestamp }: { returnTo?: string; secret: string; timestamp: string }) => createHmac("sha256", secret).update(buildPreviewLoginSignaturePayload({ returnTo, timestamp })).digest("hex")

const assertPreviewLoginSignature = (req: MedusaRequest<PreviewLoginRequest>) => {
  if (!requiresPreviewLoginSignature()) {
    return
  }

  const secret = normalizeString(PREVIEW_LOGIN_SECRET)
  const timestamp = readHeaderValue(req.headers["x-preview-login-timestamp"])
  const signature = readHeaderValue(req.headers["x-preview-login-signature"])

  if (!secret) {
    log({
      level: "error",
      module: "backend-store-preview-login",
      operation: "authorizePreviewLogin",
      phase: "error",
      reason: "missing_preview_login_secret_config",
    })
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Not found")
  }

  const timestampMs = timestamp ? Number(timestamp) : Number.NaN
  const expired = !Number.isFinite(timestampMs) || Math.abs(Date.now() - timestampMs) > PREVIEW_LOGIN_SIGNATURE_MAX_AGE_MS

  if (!timestamp || !signature || expired) {
    log({
      level: "warn",
      module: "backend-store-preview-login",
      operation: "authorizePreviewLogin",
      phase: "error",
      reason: expired ? "expired_signature" : "missing_signature",
    })
    throw new MedusaError(MedusaError.Types.UNAUTHORIZED, "Unauthorized")
  }

  const expectedSignature = createPreviewLoginSignature({
    returnTo: normalizeString(req.validatedBody?.returnTo),
    secret,
    timestamp,
  })

  if (!safeEqual(signature, expectedSignature)) {
    log({
      level: "warn",
      module: "backend-store-preview-login",
      operation: "authorizePreviewLogin",
      phase: "error",
      reason: "invalid_signature",
    })
    throw new MedusaError(MedusaError.Types.UNAUTHORIZED, "Unauthorized")
  }
}

const getBackendOrigin = (req: MedusaRequest) => {
  const configuredOrigin = normalizeString(MEDUSA_BACKEND_URL)

  if (configuredOrigin) {
    return configuredOrigin.replace(/\/+$/, "")
  }

  const host = normalizeString(req.get("host"))
  const protocol = normalizeString(req.protocol) ?? "http"

  if (!host) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Unable to resolve backend origin")
  }

  return `${protocol}://${host}`
}

const getPublishableKeyHeader = (req: MedusaRequest) => {
  const header = req.headers["x-publishable-api-key"]

  if (Array.isArray(header)) {
    return header[0]
  }

  return normalizeString(header)
}

const readJson = async (res: Response): Promise<JsonBody | string | null> => {
  const data = await res.json().catch(() => null)

  if (typeof data === "string") {
    return data
  }

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return null
  }

  return data as JsonBody
}

const extractToken = (data: unknown) => {
  if (typeof data === "string") {
    return normalizeString(data)
  }

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return undefined
  }

  return normalizeString((data as JsonBody).token)
}

const getResponseMessage = (data: JsonBody | string | null) => {
  if (typeof data === "string") {
    return normalizeString(data)
  }

  if (!data) {
    return undefined
  }

  return normalizeString(data.message) ?? normalizeString(data.error)
}

const buildAuthHeaders = ({ token, publishableKey }: { token?: string; publishableKey?: string }) => ({
  "Content-Type": "application/json",
  ...(publishableKey ? { "x-publishable-api-key": publishableKey } : {}),
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
})

const medusaPost = async (
  origin: string,
  path: string,
  {
    token,
    body,
    publishableKey,
  }: {
    token?: string
    body?: JsonBody
    publishableKey?: string
  } = {},
) =>
  fetch(`${origin}${path}`, {
    method: "POST",
    headers: buildAuthHeaders({ publishableKey, token }),
    ...(body ? { body: JSON.stringify(body) } : {}),
  })

const medusaGet = async (
  origin: string,
  path: string,
  {
    token,
    publishableKey,
  }: {
    token?: string
    publishableKey?: string
  } = {},
) =>
  fetch(`${origin}${path}`, {
    method: "GET",
    headers: buildAuthHeaders({ publishableKey, token }),
  })

const authenticateTestCustomer = async ({ origin, email, password, publishableKey }: { origin: string; email: string; password: string; publishableKey?: string }) => {
  const t0 = Date.now()
  log({
    level: "info",
    module: "backend-store-preview-login",
    operation: "authenticateTestCustomer",
    email,
  })
  const res = await medusaPost(origin, "/auth/customer/emailpass", {
    body: { email, password },
    publishableKey,
  })
  const data = await readJson(res)
  const token = extractToken(data)

  log({
    level: "info",
    module: "backend-store-preview-login",
    operation: "authenticateTestCustomer",
    duration: Date.now() - t0,
    email,
    ok: res.ok && !!token,
    status: res.status,
  })

  return {
    ok: res.ok && !!token,
    status: res.status,
    data,
    token,
  }
}

const hasCustomerSession = async ({ origin, token, publishableKey }: { origin: string; token: string; publishableKey?: string }) => {
  const t0 = Date.now()
  log({
    level: "info",
    module: "backend-store-preview-login",
    operation: "hasCustomerSession",
  })
  const res = await medusaGet(origin, "/store/customer-session", {
    publishableKey,
    token,
  })
  const data = await readJson(res)

  const valid = res.ok && !!data && typeof data === "object" && !Array.isArray(data) && !!data.customer && typeof data.customer === "object"

  log({
    level: "info",
    module: "backend-store-preview-login",
    operation: "hasCustomerSession",
    duration: Date.now() - t0,
    valid,
  })

  return valid
}

const createTestCustomer = async ({ origin, email, publishableKey, token }: { origin: string; email: string; publishableKey?: string; token: string }) => {
  const res = await medusaPost(origin, "/store/customers", {
    body: {
      email,
      first_name: "Preview",
      last_name: "User",
    },
    publishableKey,
    token,
  })
  const data = await readJson(res)

  if (!res.ok) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, typeof data === "object" && data ? (normalizeString(data.message) ?? "Unable to create test customer") : "Unable to create test customer")
  }
}

const ensureTestCustomerCanLogin = async ({ origin, email, password, publishableKey }: { origin: string; email: string; password: string; publishableKey?: string }) => {
  const t0 = Date.now()
  log({
    level: "info",
    module: "backend-store-preview-login",
    operation: "ensureTestCustomerCanLogin",
    email,
  })

  const login = await authenticateTestCustomer({
    origin,
    email,
    password,
    publishableKey,
  })

  if (login.ok && login.token) {
    if (
      await hasCustomerSession({
        origin,
        publishableKey,
        token: login.token,
      })
    ) {
      log({
        level: "info",
        module: "backend-store-preview-login",
        operation: "ensureTestCustomerCanLogin",
        duration: Date.now() - t0,
        email,
        status: "existing_session",
      })
      return login.token
    }

    await createTestCustomer({
      origin,
      email,
      publishableKey,
      token: login.token,
    })

    const customerLogin = await authenticateTestCustomer({
      origin,
      email,
      password,
      publishableKey,
    })

    if (customerLogin.ok && customerLogin.token) {
      log({
        level: "info",
        module: "backend-store-preview-login",
        operation: "ensureTestCustomerCanLogin",
        duration: Date.now() - t0,
        email,
        status: "customer_created",
      })
      return customerLogin.token
    }
  }

  const registerRes = await medusaPost(origin, "/auth/customer/emailpass/register", {
    body: { email, password },
    publishableKey,
  })
  const registerData = await readJson(registerRes)
  const registrationToken = extractToken(registerData)

  if (!registerRes.ok || !registrationToken) {
    log({
      level: "error",
      module: "backend-store-preview-login",
      operation: "ensureTestCustomerCanLogin",
      duration: Date.now() - t0,
      email,
      status: "registration_failed",
    })
    throw new MedusaError(MedusaError.Types.UNAUTHORIZED, getResponseMessage(registerData) ?? getResponseMessage(login.data) ?? "Unable to authenticate test customer")
  }

  await createTestCustomer({
    origin,
    email,
    publishableKey,
    token: registrationToken,
  })

  const verifiedLogin = await authenticateTestCustomer({
    origin,
    email,
    password,
    publishableKey,
  })

  if (!verifiedLogin.ok || !verifiedLogin.token) {
    log({
      level: "error",
      module: "backend-store-preview-login",
      operation: "ensureTestCustomerCanLogin",
      duration: Date.now() - t0,
      email,
      status: "verification_failed",
    })
    throw new MedusaError(MedusaError.Types.UNAUTHORIZED, getResponseMessage(verifiedLogin.data) ?? "Test customer was created but could not be authenticated")
  }

  log({
    level: "info",
    module: "backend-store-preview-login",
    operation: "ensureTestCustomerCanLogin",
    duration: Date.now() - t0,
    email,
    status: "success",
  })

  return verifiedLogin.token
}

export async function POST(req: MedusaRequest<PreviewLoginRequest>, res: MedusaResponse) {
  const t0 = Date.now()
  if (!isNonProductionTestLoginEnabled()) {
    log({
      level: "warn",
      module: "backend-store-preview-login",
      operation: "login",
      phase: "error",
      duration: Date.now() - t0,
      appMode: APP_MODE,
      reason: "disabled_in_production",
    })
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Not found")
  }

  assertPreviewLoginSignature(req)

  const { email, password } = readTestCustomerCredentials()
  const origin = getBackendOrigin(req)
  const publishableKey = getPublishableKeyHeader(req)

  log({
    level: "info",
    module: "backend-store-preview-login",
    operation: "login",
    phase: "start",
    email,
    origin,
  })

  try {
    const token = await ensureTestCustomerCanLogin({
      origin,
      email,
      password,
      publishableKey,
    })

    log({
      level: "info",
      module: "backend-store-preview-login",
      operation: "login",
      phase: "response",
      duration: Date.now() - t0,
      email,
    })

    return res.json({ token })
  } catch (error) {
    console.error(
      JSON.stringify({
        ts: new Date().toISOString(),
        module: "backend-store-preview-login",
        operation: "login",
        phase: "error",
        duration: Date.now() - t0,
        email,
        message: error instanceof Error ? error.message : String(error),
      }),
    )
    throw error
  }
}
