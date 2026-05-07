import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const customerId = req.auth_context.actor_id

  const customerService = req.scope.resolve("customer")
  const customerExtensionService = req.scope.resolve("customerExtension")
  const favoriteService = req.scope.resolve("favorite")
  const logger = req.scope.resolve("logger")

  // Fetch customer data
  const customer = await customerService.retrieveCustomer(customerId, {
    select: ["id", "email", "first_name", "last_name", "phone", "created_at"],
  })

  // Fetch customer extension data (WeChat fields)
  const [extensions] = await customerExtensionService.listAndCountCustomerExtensions({
    customerId,
  })

  // Fetch favorite product slugs
  const favorites = await favoriteService.listFavorites({
    customerId,
  })

  // Log session retrieval
  logger.info(`Customer session retrieved: ${customerId}`)

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
  })
}
