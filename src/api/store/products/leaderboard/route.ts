import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

function normalizeString(value: string | null | undefined): string | undefined {
  if (typeof value !== "string") return undefined
  const normalized = value.trim()
  return normalized || undefined
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const { searchParams } = new URL(
    req.url,
    `http://${req.headers.host || "localhost"}`
  )
  const productHandle = normalizeString(searchParams.get("productHandle"))
  const productId = normalizeString(searchParams.get("productId"))

  if (!productHandle && !productId) {
    return res.status(400).json({ error: "Missing productHandle or productId" })
  }

  const query = req.scope.resolve("query")
  const leaderboardService = req.scope.resolve("salesLeaderboard")

  try {
    // Resolve product handle → product ID
    let resolvedProductId = productId
    if (!resolvedProductId && productHandle) {
      const productService = req.scope.resolve("product")
      const products = await productService.listProducts(
        { handle: productHandle },
        { select: ["id"] },
      )
      if (products && products.length > 0) {
        resolvedProductId = products[0].id
      }
    }

    if (!resolvedProductId) {
      return res.json({ entries: [], totalSold: 0 })
    }

    // Query leaderboard for this product, sorted by copies DESC
    const rows = await leaderboardService.listSalesLeaderboards(
      { productId: resolvedProductId },
    )

    const sorted = (rows as any[])
      .sort((a, b) => b.totalCopies - a.totalCopies)
      .slice(0, 5)

    const totalSold = (rows as any[]).reduce(
      (sum, r) => sum + (r.totalCopies || 0),
      0,
    )

    const entries = sorted.map((entry) => ({
      id: entry.customerId || entry.id,
      name: entry.name || "Customer",
      note: entry.note || "",
      copies: entry.totalCopies,
    }))

    return res.json({ entries, totalSold })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return res.status(500).json({ error: msg })
  }
}
