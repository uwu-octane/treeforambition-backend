import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
) {
  const query = req.scope.resolve("query")
  const leaderboardService = req.scope.resolve("salesLeaderboard")
  const logger = req.scope.resolve("logger")

  try {
    // -- Aggregate orders --
    const { data: orders } = await query.graph({
      entity: "order",
      fields: [
        "id",
        "total",
        "currency_code",
        "status",
        "created_at",
        "items.*",
        "items.product_id",
        "items.quantity",
      ],
      pagination: { take: 5000, skip: 0 },
    })

    const totalOrders = orders.length
    const totalRevenue = orders.reduce((sum: number, o: any) => sum + (o.total || 0), 0)
    const totalItems = orders.reduce((sum: number, o: any) => sum + (o.items?.length || 0), 0)

    // Per-product aggregation
    const productMap = new Map<string, { title: string; sold: number; revenue: number }>()
    for (const order of orders) {
      const items = (order as any).items || []
      for (const item of items) {
        if (!item) continue
        const key = item.product_id || "unknown"
        const existing = productMap.get(key) || { title: key, sold: 0, revenue: 0 }
        existing.sold += item.quantity || 1
        existing.revenue += item.unit_price || 0
        productMap.set(key, existing)
      }
    }

    // -- Per-product leaderboard (top 5 customers per product) --
    let leaderboard: any[] = []
    try {
      const allRows = await leaderboardService.listSalesLeaderboards(
        {},
        { order: { totalCopies: "DESC" } },
      )

      // Group by product, take top 5 per product
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

    res.json({
      totalOrders,
      totalRevenue,
      totalItems,
      byProduct: Array.from(productMap.values()).sort((a, b) => b.revenue - a.revenue),
      leaderboard,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    logger.error(`[SalesAnalysis] Error: ${msg}`)
    res.status(500).json({ error: "Failed to fetch sales analysis" })
  }
}
