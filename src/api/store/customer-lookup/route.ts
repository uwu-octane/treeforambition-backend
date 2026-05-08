import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"

const log = (entry: Record<string, unknown>) => {
  console.log(JSON.stringify({ ts: new Date().toISOString(), ...entry }))
}

/**
 * Custom store API route to look up a customer by phone, wechatOpenId, or wechatUnionId.
 *
 * The customerExtension module stores WeChat and phone fields linked to the
 * Medusa customer.  This route is called server-to-server from the Next.js
 * app during the OAuth / login flow (no customer auth token is available yet).
 *
 * Query params (exactly one required):
 *   - phone            – normalized 11-digit Chinese mobile
 *   - wechat_open_id   – WeChat OpenID
 *   - wechat_union_id  – WeChat UnionID
 *
 * Returns { customer: { id, email, first_name, last_name, phone, extension } | null }
 */
export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
) {
  const t0 = Date.now()
  const phone = req.query.phone as string | undefined
  const wechatOpenId = req.query.wechat_open_id as string | undefined
  const wechatUnionId = req.query.wechat_union_id as string | undefined

  if (!phone && !wechatOpenId && !wechatUnionId) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "One of phone, wechat_open_id, or wechat_union_id is required"
    )
  }

  const customerExtensionService = req.scope.resolve("customerExtension")
  const logger = req.scope.resolve("logger")

  let filter: Record<string, string>
  if (phone) {
    filter = { phone }
  } else if (wechatOpenId) {
    filter = { wechatOpenId }
  } else {
    filter = { wechatUnionId: wechatUnionId! }
  }

  log({ level: "info", module: "backend-store-customer-lookup", operation: "lookupCustomer", filterKeys: Object.keys(filter).join(",") })

  const t1 = Date.now()
  const [extensions] = await customerExtensionService.listAndCountCustomerExtensions(
    filter
  )

  log({ level: "info", module: "backend-store-customer-lookup", operation: "queryExtensions", duration: Date.now() - t1, filterKeys: Object.keys(filter).join(","), extensionCount: extensions.length })

  if (extensions.length === 0) {
    log({ level: "info", module: "backend-store-customer-lookup", operation: "lookupCustomer", duration: Date.now() - t0, filterKeys: Object.keys(filter).join(","), status: "not_found" })
    return res.json({ customer: null })
  }

  const ext = extensions[0]
  const customerService = req.scope.resolve("customer")

  let customer: any
  try {
    const t2 = Date.now()
    customer = await customerService.retrieveCustomer(ext.customerId, {
      select: ["id", "email", "first_name", "last_name", "phone"],
    })
    log({ level: "info", module: "backend-store-customer-lookup", operation: "retrieveCustomer", duration: Date.now() - t2, customerId: ext.customerId })
  } catch (err) {
    logger?.error?.(
      `Customer lookup failed for extension ${ext.id}: ${(err as Error).message}`
    )
    log({ level: "error", module: "backend-store-customer-lookup", operation: "retrieveCustomer", duration: Date.now() - t0, extensionId: ext.id, error: (err as Error).message })
    return res.json({ customer: null })
  }

  log({ level: "info", module: "backend-store-customer-lookup", operation: "lookupCustomer", duration: Date.now() - t0, filterKeys: Object.keys(filter).join(","), customerId: customer.id, status: "success" })

  return res.json({
    customer: {
      id: customer.id,
      email: customer.email,
      first_name: customer.first_name,
      last_name: customer.last_name,
      phone: customer.phone,
      extension: {
        phone: ext.phone,
        phone_verified_at: ext.phoneVerifiedAt,
        wechat_open_id: ext.wechatOpenId,
        wechat_union_id: ext.wechatUnionId,
        wechat_nickname: ext.wechatNickname,
        wechat_avatar_url: ext.wechatAvatarUrl,
        wechat_last_login_source: ext.wechatLastLoginSource,
        wechat_authorized_at: ext.wechatAuthorizedAt,
        last_login_at: ext.lastLoginAt,
      },
    },
  })
}
