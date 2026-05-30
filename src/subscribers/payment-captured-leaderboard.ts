import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import type { Logger } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export default async function paymentCapturedLeaderboardHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger: Logger = container.resolve("logger")
  const query = container.resolve("query")
  const leaderboardService = container.resolve("salesLeaderboard")

  try {
    const paymentId = data.id

    // 1. Get payment → payment_collection_id
    const { data: payments } = await query.graph({
      entity: "payment",
      fields: ["id", "payment_collection_id"],
      filters: { id: paymentId },
    })

    const payment = payments?.[0] as any
    if (!payment?.payment_collection_id) {
      logger.warn(`[SalesLeaderboard] Payment ${paymentId} has no collection`)
      return
    }

    // 2. Find the order via the link service (order ↔ payment_collection)
    const link = container.resolve(ContainerRegistrationKeys.LINK)
    const orderLinks = await link.list({
      payment_collection_id: payment.payment_collection_id,
    })

    const orderLink = (orderLinks as any[]).find((l: any) => l.order_id)
    if (!orderLink?.order_id) {
      logger.warn(
        `[SalesLeaderboard] No order found for payment collection ${payment.payment_collection_id}`
      )
      return
    }

    const orderId = orderLink.order_id

    // 3. Query the order with items and variant metadata
    const { data: orders } = await query.graph({
      entity: "order",
      fields: [
        "id",
        "customer_id",
        "items.*",
        "items.variant_id",
        "items.product_id",
        "items.quantity",
        "items.variant.*",
        "items.variant.metadata",
      ],
      filters: { id: orderId },
    })

    const order = orders?.[0] as any
    if (!order) {
      logger.warn(`[SalesLeaderboard] Order ${orderId} not found`)
      return
    }

    const customerId = order.customer_id
    if (!customerId) {
      logger.info(`[SalesLeaderboard] Order ${orderId} — no customer, skipping`)
      return
    }

    const orderItems = order.items || []
    if (!orderItems.length) return

    // 4. Calculate copies per item (considering kit_quantity from variant metadata)
    const itemCounts = orderItems.map((item: any) => {
      const meta = item.variant?.metadata ?? {}
      const kitQty =
        typeof meta?.kit_quantity === "number"
          ? meta.kit_quantity
          : typeof meta?.item_quantity === "number"
            ? meta.item_quantity
            : 1
      return {
        productId: item.product_id,
        variantId: item.variant_id,
        copies: (item.quantity || 0) * kitQty,
      }
    })

    // Aggregate per product
    const byProduct = new Map<string, number>()
    for (const ic of itemCounts) {
      byProduct.set(ic.productId, (byProduct.get(ic.productId) || 0) + ic.copies)
    }

    const totalCopies = Array.from(byProduct.values()).reduce((a, b) => a + b, 0)

    logger.info(
      `[SalesLeaderboard] Payment ${paymentId} captured → order ${orderId} (${totalCopies} total copies)`
    )

    // 5. Resolve display name
    const { data: customers } = await query.graph({
      entity: "customer",
      fields: ["id", "first_name", "last_name", "metadata"],
      filters: { id: customerId },
    })
    const cust = customers?.[0] as any
    const displayName =
      [cust?.first_name, cust?.last_name].filter(Boolean).join(" ") || customerId.slice(0, 8)
    const displayNote =
      (cust?.metadata as any)?.city || (cust?.metadata as any)?.company_name || ""

    // 6. Upsert leaderboard entries
    for (const [productId, copies] of byProduct) {
      const existing = await leaderboardService.listSalesLeaderboards({
        productId,
        customerId,
      })

      if (existing && existing.length > 0) {
        const record = existing[0] as any
        await leaderboardService.updateSalesLeaderboards({
          id: record.id,
          totalCopies: (record.totalCopies || 0) + copies,
          name: displayName,
          note: displayNote,
        })
        logger.info(`[SalesLeaderboard] +${copies} for ${displayName} (product ${productId})`)
      } else {
        await leaderboardService.createSalesLeaderboards({
          productId,
          customerId,
          totalCopies: copies,
          name: displayName,
          note: displayNote,
        })
        logger.info(
          `[SalesLeaderboard] New: ${displayName} — ${copies} copies (product ${productId})`
        )
      }
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    logger.error(`[SalesLeaderboard] Error: ${msg}`)
  }
}

export const config: SubscriberConfig = {
  event: "payment.captured",
}
