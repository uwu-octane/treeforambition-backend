import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import type { IOrderModuleService, Logger } from "@medusajs/framework/types"

export default async function orderPlacedLeaderboardHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger: Logger = container.resolve("logger")
  const query = container.resolve("query")
  const orderService: IOrderModuleService = container.resolve("order")
  const leaderboardService = container.resolve("salesLeaderboard")

  try {
    const orderId = data.id

    const { data: orders } = await query.graph({
      entity: "order",
      fields: [
        "id",
        "customer_id",
        "metadata",
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

    const items = order.items || []
    if (!items.length) return

    // Calculate copies per item.
    // A variant may represent multiple physical items via Inventory Kit.
    // Check variant metadata for kit_quantity; also support legacy item_quantity.
    const itemCounts = items.map((item: any) => {
      const meta = item.variant?.metadata ?? {}
      const kitQty = typeof meta?.kit_quantity === "number"
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

    // Aggregate copies per product (a single order may have multiple variants of the same product)
    const byProduct = new Map<string, number>()
    for (const ic of itemCounts) {
      byProduct.set(ic.productId, (byProduct.get(ic.productId) || 0) + ic.copies)
    }

    const totalCopies = Array.from(byProduct.values()).reduce((a, b) => a + b, 0)

    // Store item counts in order metadata
    const existingMeta = (order.metadata ?? {}) as Record<string, unknown>
    await orderService.updateOrders({
      selector: { id: orderId },
      data: {
        metadata: {
          ...existingMeta,
          item_counts: itemCounts,
          total_copies: totalCopies,
        },
      },
    } as any)

    logger.info(`[SalesLeaderboard] Order ${orderId} metadata updated (${totalCopies} total copies)`)

    // Resolve display name for the leaderboard
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

    // Upsert leaderboard entries
    for (const [productId, copies] of byProduct) {
      const existing = await leaderboardService.listSalesLeaderboards(
        { productId, customerId },
      )

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
        logger.info(`[SalesLeaderboard] New: ${displayName} — ${copies} copies (product ${productId})`)
      }
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    logger.error(`[SalesLeaderboard] Error: ${msg}`)
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
