/**
 * Backfill script: ensures all existing products have published_year and published_month
 * in their metadata, extracted from created_at if missing.
 *
 * Usage:
 *   cd treeforambition-backend && npx medusa exec src/scripts/backfill-product-published-dates.ts
 */
import { ExecArgs } from "@medusajs/framework/types"
import { ensureProductPublishedDatesWorkflow } from "../workflows/ensure-product-published-dates"

export default async function backfillProductPublishedDates({ container }: ExecArgs) {
  const query = container.resolve("query")
  const logger = container.resolve("logger")

  logger.info("[BackfillPublishedDates] Fetching all products...")

  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id"],
    filters: {},
  })

  logger.info(`[BackfillPublishedDates] Found ${products.length} products`)

  let changed = 0
  let unchanged = 0

  for (const product of products) {
    try {
      const { result } = await ensureProductPublishedDatesWorkflow(container).run({
        input: { product_id: product.id },
      })

      if (result && (result as any).changed) {
        changed++
      } else {
        unchanged++
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      logger.error(`[BackfillPublishedDates] Error for ${product.id}: ${msg}`)
    }
  }

  logger.info(`[BackfillPublishedDates] Done. Changed: ${changed}, Unchanged: ${unchanged}`)
}
