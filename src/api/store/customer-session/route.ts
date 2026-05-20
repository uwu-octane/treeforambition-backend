import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

const log = (entry: Record<string, unknown>) => {
  console.log(JSON.stringify({ ts: new Date().toISOString(), ...entry }))
}

export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const t0 = Date.now()
  const customerId = req.auth_context.actor_id

  const customerService = req.scope.resolve("customer")
  const customerExtensionService = req.scope.resolve("customerExtension")
  const favoriteService = req.scope.resolve("favorite")
  const query = req.scope.resolve("query")
  const logger = req.scope.resolve("logger")

  log({ level: "info", module: "backend-store-customer-session", operation: "getSession", phase: "start", customerId })

  try {
    // Fetch customer data
    const t1 = Date.now()
    const customer = await customerService.retrieveCustomer(customerId, {
      select: ["id", "email", "first_name", "last_name", "phone", "created_at"],
    })
    log({ level: "info", module: "backend-store-customer-session", operation: "retrieveCustomer", phase: "step", duration: Date.now() - t1, customerId })

    // Fetch customer extension data (WeChat fields)
    const t2 = Date.now()
    const [extensions] = await customerExtensionService.listAndCountCustomerExtensions({
      customerId,
    })
    log({ level: "info", module: "backend-store-customer-session", operation: "listCustomerExtensions", phase: "step", duration: Date.now() - t2, customerId, extensionCount: extensions.length })

    // Fetch favorite product slugs
    const t3 = Date.now()
    const favorites = await favoriteService.listFavorites({
      customerId,
    })
    log({ level: "info", module: "backend-store-customer-session", operation: "listFavorites", phase: "step", duration: Date.now() - t3, customerId, favoriteCount: favorites.length })

    const t4 = Date.now()
    const { data: addresses } = await query.graph({
      entity: "address",
      fields: [
        "id",
        "address_name",
        "is_default_shipping",
        "is_default_billing",
        "customer_id",
        "company",
        "first_name",
        "last_name",
        "address_1",
        "address_2",
        "city",
        "country_code",
        "province",
        "postal_code",
        "phone",
        "metadata",
        "created_at",
        "updated_at",
      ],
      filters: {
        customer_id: customerId,
      },
    })
    const defaultAddress = addresses.find((address) => {
      const source = address as Record<string, unknown>

      return Boolean(source.is_default_shipping || source.is_default_billing)
    })
    log({ level: "info", module: "backend-store-customer-session", operation: "queryAddresses", phase: "step", duration: Date.now() - t4, customerId, addressCount: addresses.length })

    // Log session retrieval
    logger.info(`Customer session retrieved: ${customerId}`)
    log({ level: "info", module: "backend-store-customer-session", operation: "getSession", phase: "response", duration: Date.now() - t0, customerId })

    return res.json({
      customer: {
        id: customer.id,
        email: customer.email,
        first_name: customer.first_name,
        last_name: customer.last_name,
        phone: customer.phone,
        created_at: customer.created_at,
        extension: extensions.length > 0 ? {
          phone: extensions[0].phone,
          phone_verified_at: extensions[0].phoneVerifiedAt,
          wechat_app_id: extensions[0].wechatAppId,
          wechat_open_id: extensions[0].wechatOpenId,
          wechat_union_id: extensions[0].wechatUnionId,
          wechat_nickname: extensions[0].wechatNickname,
          wechat_avatar_url: extensions[0].wechatAvatarUrl,
          wechat_last_login_source: extensions[0].wechatLastLoginSource,
          wechat_authorized_at: extensions[0].wechatAuthorizedAt,
          last_login_at: extensions[0].lastLoginAt,
        } : null,
      },
      favorites: favorites.map((f) => ({
        product_slug: f.productSlug,
        product_id: f.productId,
      })),
      addresses,
      defaultAddressID: defaultAddress?.id ?? addresses[0]?.id ?? null,
    })
  } catch (error) {
    console.error(JSON.stringify({
      ts: new Date().toISOString(),
      module: "backend-store-customer-session",
      operation: "getSession",
      phase: "error",
      duration: Date.now() - t0,
      customerId,
      message: error instanceof Error ? error.message : String(error),
    }))
    throw error;
  }
}
