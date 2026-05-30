import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import type { IOrderModuleService, Logger } from "@medusajs/framework/types"

// This subscriber writes per-item copy counts into order metadata at order.placed time.
// Leaderboard upserts now happen after payment capture (see payment-captured-leaderboard.ts)
// so that only paid orders contribute to the sales ranking.

export default async function orderPlacedMetadataHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger: Logger = container.resolve("logger")
  const query = container.resolve("query")
  const orderService: IOrderModuleService = container.resolve("order")

  try {
    const orderId = data.id

    const { data: orders } = await query.graph({
      entity: "order",
      fields: [
        "id",
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
      logger.warn(`[OrderMetadata] Order ${orderId} not found`)
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

    // Aggregate copies per product
    const byProduct = new Map<string, number>()
    for (const ic of itemCounts) {
      byProduct.set(ic.productId, (byProduct.get(ic.productId) || 0) + ic.copies)
    }

    const totalCopies = Array.from(byProduct.values()).reduce((a, b) => a + b, 0)

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

    logger.info(`[OrderMetadata] Order ${orderId} metadata updated (${totalCopies} total copies)`)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    logger.error(`[OrderMetadata] Error: ${msg}`)
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
