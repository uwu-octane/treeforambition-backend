import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

const log = (entry: Record<string, unknown>) => {
  console.log(JSON.stringify({ ts: new Date().toISOString(), ...entry }))
}

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
) {
  const t0 = Date.now()
  const query = req.scope.resolve("query")
  const logger = req.scope.resolve("logger")

  log({ level: "info", module: "salesAnalysis", operation: "getSalesAnalysis" })

  logger.info("[SalesAnalysis] Fetching data")

  try {
    const queryT0 = Date.now()
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
    log({ level: "info", module: "salesAnalysis", operation: "queryOrders", duration: Date.now() - queryT0, entity: "order", orderCount: orders.length })

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

    log({ level: "info", module: "salesAnalysis", operation: "getSalesAnalysis", duration: Date.now() - t0, totalOrders, totalRevenue, totalItems, uniqueProducts: productMap.size, status: "success" })

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
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error(`[SalesAnalysis] Error: ${error}`)
    log({ level: "error", module: "salesAnalysis", operation: "getSalesAnalysis", duration: Date.now() - t0, error: errorMessage })
    res.status(500).json({ error: "Failed to fetch sales analysis" })
  }
}
