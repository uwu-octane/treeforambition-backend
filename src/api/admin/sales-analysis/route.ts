import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
) {
  const query = req.scope.resolve("query")
  const logger = req.scope.resolve("logger")

  logger.info("[SalesAnalysis] Fetching data")

  try {
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
      ],
      pagination: { take: 1000, skip: 0 },
    })

    const totalOrders = orders.length
    const totalRevenue = orders.reduce(
      (sum, o) => sum + ((o as any).total || 0),
      0
    )
    const totalItems = orders.reduce(
      (sum, o) => sum + ((o as any).items?.length || 0),
      0
    )

    const productMap = new Map<
      string,
      { title: string; sold: number; revenue: number }
    >()
    for (const order of orders) {
      const items = (order as any).items || []
      for (const item of items) {
        if (!item) continue
        const key = item.product_id || "unknown"
        const existing = productMap.get(key) || {
          title: key,
          sold: 0,
          revenue: 0,
        }
        existing.sold += item.quantity || 1
        existing.revenue += item.unit_price || 0
        productMap.set(key, existing)
      }
    }

    res.json({
      totalOrders,
      totalRevenue,
      totalItems,
      byPerson: [],
      byProduct: Array.from(productMap.values()).sort(
        (a, b) => b.revenue - a.revenue
      ),
    })
  } catch (error) {
    logger.error(`[SalesAnalysis] Error: ${error}`)
    res.status(500).json({ error: "Failed to fetch sales analysis" })
  }
}
