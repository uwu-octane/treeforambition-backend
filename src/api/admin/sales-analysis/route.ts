import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const leaderboardService = req.scope.resolve("salesLeaderboard")
  const logger = req.scope.resolve("logger")

  try {
    // 1. Fetch all orders
    const { data: orders } = await query.graph({
      entity: "order",
      fields: [
        "id",
        "total",
        "currency_code",
        "status",
        "created_at",
        "customer_id",
        "items.*",
        "items.product_id",
        "items.product_title",
        "items.quantity",
        "items.unit_price",
      ],
      pagination: { take: 5000, skip: 0 },
    })

    // 2. Find which orders have captured payments via the link service.
    const capturedOrderIds = new Set<string>()

    try {
      const { data: allPayments } = await query.graph({
        entity: "payment",
        fields: ["id", "payment_collection_id", "captured_at"],
        pagination: { take: 10000, skip: 0 },
      })

      const capturedCollectionIds = new Set(
        (allPayments as any[])
          .filter((p) => p.captured_at != null)
          .map((p) => p.payment_collection_id)
          .filter(Boolean),
      )

      if (capturedCollectionIds.size > 0) {
        const link = req.scope.resolve(ContainerRegistrationKeys.LINK)

        for (const pcId of capturedCollectionIds) {
          try {
            const links = await link.list({ payment_collection_id: pcId })
            for (const entry of links as any[]) {
              if (entry.order_id) capturedOrderIds.add(entry.order_id)
            }
          } catch {
            // Individual link lookup failed — skip this collection
          }
        }
      }
    } catch (err) {
      logger.warn(`[SalesAnalysis] Could not resolve captured payments: ${err}`)
    }

    // 3. Filter to captured orders (fall back to all orders if filter failed)
    const filteredOrders = capturedOrderIds.size > 0
      ? (orders as any[]).filter((o) => capturedOrderIds.has(o.id))
      : (orders as any[])

    const totalOrders = filteredOrders.length
    const totalRevenue = filteredOrders.reduce((sum: number, o: any) => sum + (o.total || 0), 0)
    const totalItems = filteredOrders.reduce(
      (sum: number, o: any) =>
        sum + (o.items || []).reduce((s: number, i: any) => s + (i.quantity || 0), 0),
      0
    )

    // 4. Per-product aggregation
    const productMap = new Map<string, { title: string; sold: number; revenue: number }>()
    for (const order of filteredOrders) {
      const items = order.items || []
      for (const item of items) {
        if (!item) continue
        const key = item.product_id || "unknown"
        const title = item.product_title || key
        const existing = productMap.get(key) || { title, sold: 0, revenue: 0 }
        existing.sold += item.quantity || 0
        existing.revenue += (item.unit_price || 0) * (item.quantity || 0)
        productMap.set(key, existing)
      }
    }

    // 5. Per-product leaderboard (top 5 customers per product)
    let leaderboard: any[] = []
    try {
      const allRows = await leaderboardService.listSalesLeaderboards(
        {},
        { order: { totalCopies: "DESC" } }
      )

      const byProduct = new Map<string, any[]>()
      for (const row of allRows) {
        const list = byProduct.get(row.productId) || []
        list.push(row)
        byProduct.set(row.productId, list)
      }

      leaderboard = Array.from(byProduct.entries()).map(([productId, entries]) => {
        const sorted = entries.sort((a: any, b: any) => b.totalCopies - a.totalCopies)
        const top5 = sorted.slice(0, 5).map((e: any, i: number) => ({
          rank: i + 1,
          name: e.name || e.customerId?.slice(0, 8) || "Unknown",
          note: e.note || "",
          copies: e.totalCopies,
        }))
        const totalSold = sorted.reduce((sum: number, e: any) => sum + e.totalCopies, 0)
        return { productId, totalSold, entries: top5 }
      })
    } catch (err) {
      logger.warn(`[SalesAnalysis] Leaderboard not available: ${err}`)
    }

    return res.json({
      totalOrders,
      totalRevenue,
      totalItems,
      byProduct: Array.from(productMap.values()).sort((a, b) => b.revenue - a.revenue),
      leaderboard,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    logger.error(`[SalesAnalysis] Error: ${msg}`)
    return res.status(500).json({ error: "Failed to fetch sales analysis" })
  }
}
