import crypto from "node:crypto"
import { createCustomerAccountWorkflow, setAuthAppMetadataWorkflow } from "@medusajs/core-flows"
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, generateJwtToken, MedusaError, Modules } from "@medusajs/framework/utils"
import { z } from "zod"

export const WechatAuthCallbackSchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
})

export type WechatAuthCallbackRequest = z.infer<typeof WechatAuthCallbackSchema>

type AuthIdentityLike = {
  id: string
  app_metadata?: Record<string, unknown> | null
  provider_identities?: Array<{
    provider?: string
    user_metadata?: Record<string, unknown> | null
  }>
}

const PROVIDER_ID = "wechat-mp"
const CUSTOMER_EMAIL_DOMAIN = "customers.treeforambition.local"

const log = (entry: Record<string, unknown>) => {
  console.log(JSON.stringify({ ts: new Date().toISOString(), ...entry }))
}

const readString = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : undefined

const getWechatMetadata = (authIdentity: AuthIdentityLike) => {
  const providerIdentity = authIdentity.provider_identities?.find(
    (identity) => identity.provider === PROVIDER_ID
  )

  return (providerIdentity?.user_metadata ?? {}) as Record<string, unknown>
}

const getCustomerId = (authIdentity: AuthIdentityLike) =>
  readString(authIdentity.app_metadata?.customer_id)

const buildCustomerEmail = (metadata: Record<string, unknown>) => {
  const appId = readString(metadata.wechat_app_id) || "wechat"
  const openId = readString(metadata.wechat_open_id)
  const source = `${appId}:${openId || crypto.randomUUID()}`
  const hash = crypto.createHash("sha256").update(source).digest("hex").slice(0, 24)

  return `wechat-${hash}@${CUSTOMER_EMAIL_DOMAIN}`
}

const createCustomerForAuthIdentity = async (
  req: MedusaRequest,
  authIdentity: AuthIdentityLike,
  metadata: Record<string, unknown>
) => {
  const email = buildCustomerEmail(metadata)

  const { result } = await createCustomerAccountWorkflow(req.scope).run({
    input: {
      authIdentityId: authIdentity.id,
      customerData: {
        email,
        first_name: readString(metadata.wechat_nickname) || "WeChat",
        metadata: {
          auth_provider: PROVIDER_ID,
          wechat_app_id: readString(metadata.wechat_app_id) || null,
          wechat_open_id: readString(metadata.wechat_open_id) || null,
          wechat_union_id: readString(metadata.wechat_union_id) || null,
        },
      },
    },
  })

  return result.id
}

const linkExistingCustomerToAuthIdentity = async (
  req: MedusaRequest,
  authIdentity: AuthIdentityLike,
  customerId: string
) => {
  await setAuthAppMetadataWorkflow(req.scope).run({
    input: {
      actorType: "customer",
      authIdentityId: authIdentity.id,
      value: customerId,
    },
  })
}

const findExistingWechatExtension = async (
  customerExtensionService: any,
  metadata: Record<string, unknown>
) => {
  const openId = readString(metadata.wechat_open_id)
  const unionId = readString(metadata.wechat_union_id)

  if (openId) {
    const [extensions] = await customerExtensionService.listAndCountCustomerExtensions({
      wechatOpenId: openId,
    })

    if (extensions[0]) {
      return extensions[0]
    }
  }

  if (unionId) {
    const [extensions] = await customerExtensionService.listAndCountCustomerExtensions({
      wechatUnionId: unionId,
    })

    if (extensions[0]) {
      return extensions[0]
    }
  }

  return null
}

const upsertCustomerExtension = async (
  customerExtensionService: any,
  customerId: string,
  metadata: Record<string, unknown>
) => {
  const now = new Date()
  const existingWechatExtension = await findExistingWechatExtension(customerExtensionService, metadata)
  const [customerExtensions] = await customerExtensionService.listAndCountCustomerExtensions({
    customerId,
  })
  const existing = existingWechatExtension ?? customerExtensions[0]

  const data = {
    customerId,
    lastLoginAt: now,
    wechatAppId: readString(metadata.wechat_app_id) || null,
    wechatAuthorizedAt: now,
    wechatAvatarUrl: readString(metadata.wechat_avatar_url) || null,
    wechatLastLoginSource: "service_h5",
    wechatNickname: readString(metadata.wechat_nickname) || null,
    wechatOpenId: readString(metadata.wechat_open_id) || null,
    wechatUnionId: readString(metadata.wechat_union_id) || null,
  }

  if (existing) {
    return await customerExtensionService.updateCustomerExtensions({
      id: existing.id,
      ...data,
    })
  }

  return await customerExtensionService.createCustomerExtensions(data)
}

const buildCustomerToken = async (
  req: MedusaRequest,
  authIdentity: AuthIdentityLike,
  customerId: string
) => {
  const config = req.scope.resolve(ContainerRegistrationKeys.CONFIG_MODULE)
  const { http } = config.projectConfig
  const userMetadata = getWechatMetadata(authIdentity)

  return generateJwtToken(
    {
      actor_id: customerId,
      actor_type: "customer",
      auth_identity_id: authIdentity.id,
      auth_provider: PROVIDER_ID,
      app_metadata: {
        ...(authIdentity.app_metadata ?? {}),
        customer_id: customerId,
      },
      user_metadata: userMetadata,
    },
    {
      secret: http.jwtSecret,
      expiresIn: http.jwtExpiresIn,
      jwtOptions: http.jwtOptions,
    }
  )
}

export async function POST(
  req: MedusaRequest<WechatAuthCallbackRequest>,
  res: MedusaResponse
) {
  const t0 = Date.now()
  const authService = req.scope.resolve(Modules.AUTH)
  const customerExtensionService = req.scope.resolve("customerExtension")

  log({
    level: "info",
    module: "backend-store-wechat-auth",
    operation: "callback",
    phase: "start",
  })

  const { success, error, authIdentity } = await authService.validateCallback(PROVIDER_ID, {
    body: {
      code: req.validatedBody.code,
      state: req.validatedBody.state,
    },
    headers: req.headers as Record<string, string>,
    protocol: req.protocol,
    url: req.url,
  })

  if (!success || !authIdentity) {
    throw new MedusaError(
      MedusaError.Types.UNAUTHORIZED,
      error || "WeChat authentication failed"
    )
  }

  const metadata = getWechatMetadata(authIdentity as AuthIdentityLike)
  const openId = readString(metadata.wechat_open_id)

  if (!openId) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "WeChat authentication did not return an openid"
    )
  }

  const existingExtension = await findExistingWechatExtension(customerExtensionService, metadata)
  let customerId = getCustomerId(authIdentity as AuthIdentityLike)

  const existingExtensionCustomerId = readString(existingExtension?.customerId)
  if (!customerId && existingExtensionCustomerId) {
    customerId = existingExtensionCustomerId
    await linkExistingCustomerToAuthIdentity(req, authIdentity as AuthIdentityLike, customerId)
  }

  if (!customerId) {
    customerId = await createCustomerForAuthIdentity(req, authIdentity as AuthIdentityLike, metadata)
  }

  await upsertCustomerExtension(customerExtensionService, customerId, metadata)

  const refreshedAuthIdentity = (await authService.retrieveAuthIdentity(authIdentity.id, {
    relations: ["provider_identities"],
  })) as AuthIdentityLike
  const token = await buildCustomerToken(req, refreshedAuthIdentity, customerId)

  log({
    level: "info",
    module: "backend-store-wechat-auth",
    operation: "callback",
    phase: "response",
    duration: Date.now() - t0,
    customerId,
  })

  return res.json({
    customer_id: customerId,
    token,
  })
}
