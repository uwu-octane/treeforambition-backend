import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError, ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { completeCartWorkflow } from "@medusajs/medusa/core-flows"
import { z } from "zod"
import { PREVIEW_PAYMENT_MODE, WECHAT_SERVICE_APP_ID } from "../../../lib/env"

const log = (entry: Record<string, unknown>) => {
  console.log(JSON.stringify({ ts: new Date().toISOString(), ...entry }))
}

// Checkout request schema matching the frontend payload
export const CheckoutRequestSchema = z.object({
  addressId: z.string().optional(),
  customerEmail: z.string().email().optional(),
  items: z.array(z.object({
    productId: z.string().min(1),
    routeVariantSlug: z.string().optional(),
    quantity: z.number().int().min(1),
  })),
  orderIssuedAt: z.string().optional(),
  orderNote: z.string().optional(),
  orderNumber: z.string().optional(),
  shippingMethodID: z.string().optional(),
  shippingMethodLabel: z.string().optional(),
  paymentMethod: z.enum(["wechat_jsapi", "manual"]).default("wechat_jsapi"),
})

export type CheckoutRequest = z.infer<typeof CheckoutRequestSchema>

export async function POST(
  req: AuthenticatedMedusaRequest<CheckoutRequest>,
  res: MedusaResponse
) {
  const t0 = Date.now()
  const body = req.validatedBody
  const customerId = req.auth_context.actor_id
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const logger = req.scope.resolve("logger")
  const cartModuleService = req.scope.resolve(Modules.CART)
  const paymentModuleService = req.scope.resolve(Modules.PAYMENT)
  const link = req.scope.resolve(ContainerRegistrationKeys.LINK)

  const isMockPayment = PREVIEW_PAYMENT_MODE === "mock_success"
  const itemCount = body.items?.length || 0

  log({ level: "info", module: "backend-store-checkout", operation: "checkout", phase: "start", customerId, paymentMethod: body.paymentMethod, isMockPayment, itemCount })

  logger.info(
    `[Checkout] initiated customer=${customerId} mock=${isMockPayment} payment=${body.paymentMethod}`
  )

  try {
    // ============================================================
    // 1. Resolve store defaults (region and sales channel)
    // ============================================================
    const t1 = Date.now()
    const { data: regions } = await query.graph({
      entity: "region",
      fields: ["id", "currency_code"],
      pagination: { take: 1, skip: 0 },
    })

    if (!regions?.length) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "No region configured in the store"
      )
    }

    const region = regions[0]
    const currencyCode = region.currency_code

    const { data: salesChannels } = await query.graph({
      entity: "sales_channel",
      fields: ["id"],
      pagination: { take: 1, skip: 0 },
    })
    const salesChannelId = salesChannels?.[0]?.id

    log({ level: "info", module: "backend-store-checkout", operation: "resolveStoreDefaults", duration: Date.now() - t1, regionId: region.id, salesChannelId })

    // ============================================================
    // 2. Resolve each item by product handle (productId) to variant ID
    // ============================================================
    const t2 = Date.now()
    const lineItems: Array<{ variant_id: string; quantity: number }> = []

    for (const item of body.items) {
      const { data: products } = await query.graph({
        entity: "product",
        fields: ["id", "title", "handle", "variants.id", "variants.title"],
        filters: { handle: item.productId },
      })

      if (!products?.length) {
        throw new MedusaError(
          MedusaError.Types.NOT_FOUND,
          `Product not found by handle: ${item.productId}`
        )
      }

      const product = products[0]
      let variant: any = null

      if (item.routeVariantSlug) {
        variant = product.variants?.find(
          (v: any) => v.title === item.routeVariantSlug
        )
      }

      if (!variant && product.variants?.length) {
        variant = product.variants[0]
      }

      if (!variant) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `No variant found for product: ${item.productId}` +
            (item.routeVariantSlug ? ` (variant: ${item.routeVariantSlug})` : "")
        )
      }

      lineItems.push({
        variant_id: variant.id,
        quantity: item.quantity,
      })
    }

    log({ level: "info", module: "backend-store-checkout", operation: "resolveLineItems", duration: Date.now() - t2, lineItemCount: lineItems.length })

    // ============================================================
    // 3. Resolve shipping address
    // ============================================================
    const t3 = Date.now()
    let shippingAddress: Record<string, any> | undefined

    if (body.addressId) {
      // Fetch a saved address
      const { data: addresses } = await query.graph({
        entity: "address",
        fields: [
          "id",
          "first_name",
          "last_name",
          "phone",
          "address_1",
          "address_2",
          "city",
          "province",
          "postal_code",
          "country_code",
          "metadata",
        ],
        filters: { id: body.addressId, customer_id: customerId },
      })

      if (!addresses?.length) {
        throw new MedusaError(
          MedusaError.Types.NOT_FOUND,
          `Shipping address not found: ${body.addressId}`
        )
      }

      const addr = addresses[0]
      shippingAddress = {
        first_name: addr.first_name || addr.metadata?.recipientName || "",
        last_name: addr.last_name || "",
        phone: addr.phone,
        address_1: addr.address_1,
        address_2: addr.address_2 || undefined,
        city: addr.city,
        province: addr.province || undefined,
        postal_code: addr.postal_code || undefined,
        country_code: (addr.country_code || "cn").toLowerCase(),
      }
    }

    log({ level: "info", module: "backend-store-checkout", operation: "resolveShippingAddress", duration: Date.now() - t3, addressId: body.addressId || null, hasAddress: !!shippingAddress })

    // ============================================================
    // 4. Create the cart with items and shipping address
    // ============================================================
    const t4 = Date.now()
    const cart = await cartModuleService.createCarts({
      currency_code: currencyCode,
      region_id: region.id,
      ...(salesChannelId ? { sales_channel_id: salesChannelId } : {}),
      customer_id: customerId,
      ...(body.customerEmail ? { email: body.customerEmail } : {}),
      ...(shippingAddress ? { shipping_address: shippingAddress } : {}),
      items: lineItems.map((item) => ({
        variant_id: item.variant_id,
        quantity: item.quantity,
        title: "",
        unit_price: 0,
      })),
    })

    const cartId = cart.id
    log({ level: "info", module: "backend-store-checkout", operation: "createCart", duration: Date.now() - t4, cartId })

    // ============================================================
    // 5. Add shipping method
    // ============================================================
    const t5 = Date.now()
    if (body.shippingMethodLabel) {
      await cartModuleService.addShippingMethods(cartId, [
        {
          name: body.shippingMethodLabel,
          amount: 0,
        },
      ])
    }
    log({ level: "info", module: "backend-store-checkout", operation: "addShippingMethod", duration: Date.now() - t5, cartId, shippingMethodLabel: body.shippingMethodLabel || null })

    // ============================================================
    // 6. Create payment collection and session
    // ============================================================
    const t6 = Date.now()
    // Determine the payment provider:
    // - Mock/preview mode -> use the built-in system provider (always succeeds)
    // - WeChat JSAPI       -> use the custom wechat payment provider
    // - Manual             -> use the custom manual payment provider
    const paymentProvider = isMockPayment
      ? "pp_system_default"
      : body.paymentMethod === "wechat_jsapi"
        ? "pp_wechat_jsapi_default"
        : "pp_manual_default"

    const [paymentCollection] = await paymentModuleService.createPaymentCollections({
      currency_code: currencyCode,
      amount: 0,
    } as any)

    // Link the payment collection to the cart so the complete-cart workflow
    // can find it and authorize payment.
    await link.create({
      [Modules.CART]: { cart_id: cartId },
      [Modules.PAYMENT]: { payment_collection_id: paymentCollection.id },
    })

    await paymentModuleService.createPaymentSession(paymentCollection.id, {
      provider_id: paymentProvider,
      currency_code: currencyCode,
      amount: 0,
      data: {},
    })

    log({ level: "info", module: "backend-store-checkout", operation: "createPayment", duration: Date.now() - t6, paymentProvider, paymentCollectionId: paymentCollection.id, cartId })

    // ============================================================
    // 7. Complete the cart -> converts it to an order
    // ============================================================
    const t7 = Date.now()
    const { result } = await completeCartWorkflow(req.scope).run({
      input: { id: cartId },
    })

    const workflowResult = result as unknown as {
      type: "order" | "cart"
      order?: any
      cart?: any
      error?: { message: string }
    }

    if (workflowResult.type === "cart") {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        workflowResult.error?.message || "Cart completion failed"
      )
    }

    const order = workflowResult.order
    log({ level: "info", module: "backend-store-checkout", operation: "completeCart", duration: Date.now() - t7, orderId: order.id, displayId: order.display_id })

    logger.info(
      `[Checkout] completed orderId=${order.id} displayId=${order.display_id}`
    )

    // ============================================================
    // 8. Build payment data for the frontend response
    // ============================================================
    const mockPrepayId = `prepay_mock_${Date.now().toString(36)}`
    const paymentData = {
      prepayId: mockPrepayId,
      appId: WECHAT_SERVICE_APP_ID || "mock_app_id",
      timeStamp: String(Math.floor(Date.now() / 1000)),
      nonceStr: Math.random().toString(36).substring(2),
      package: `prepay_id=${mockPrepayId}`,
      signType: "RSA",
      paySign: "mock_sign",
    }

    log({ level: "info", module: "backend-store-checkout", operation: "checkout", phase: "response", duration: Date.now() - t0, orderId: order.id, displayId: order.display_id })

    return res.json({
      success: true,
      orderID: order.id,
      orderNumber: order.display_id,
      payment: body.paymentMethod === "wechat_jsapi" ? paymentData : undefined,
      paymentSession: body.paymentMethod === "wechat_jsapi" ? paymentData : undefined,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    log({ level: "error", module: "backend-store-checkout", operation: "checkout", phase: "error", duration: Date.now() - t0, customerId, itemCount, error: errorMessage })
    logger.error(
      `[Checkout] failed: ${errorMessage}`
    )
    return res.status(500).json({
      success: false,
      error: errorMessage,
    })
  }
}
