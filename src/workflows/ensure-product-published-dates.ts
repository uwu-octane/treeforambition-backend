import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import type { Logger } from "@medusajs/framework/types"

type EnsureProductPublishedDatesInput = {
  product_id: string
}

const ensurePublishedDatesStep = createStep(
  "ensure-published-dates",
  async ({ product_id }: EnsureProductPublishedDatesInput, { container }) => {
    const logger: Logger = container.resolve("logger")
    const query = container.resolve("query")
    const productService = container.resolve("product") as any

    const { data: products } = await query.graph({
      entity: "product",
      fields: ["id", "metadata", "created_at"],
      filters: { id: product_id },
    })

    const product = products?.[0] as any
    if (!product) {
      logger.warn(`[EnsurePublishedDates] Product ${product_id} not found`)
      return new StepResponse(null)
    }

    const meta = (product.metadata ?? {}) as Record<string, unknown>

    // Already fully normalized
    if (meta.published_year && meta.published_month) {
      return new StepResponse({
        unchanged: true,
        published_year: meta.published_year,
        published_month: meta.published_month,
      })
    }

    // Resolve from legacy keys, then fall back to created_at
    const resolvedYear = (meta.published_year ?? meta.publish_year) as number | undefined
    const resolvedMonth = (meta.published_month ?? meta.publish_month) as number | undefined

    const createdAt = product.created_at ? new Date(product.created_at as string) : new Date()
    const newYear = resolvedYear ?? createdAt.getFullYear()
    const newMonth = resolvedMonth ?? createdAt.getMonth() + 1

    // Normalize key names
    const updatedMeta: Record<string, unknown> = { ...meta }
    delete updatedMeta.publish_year
    delete updatedMeta.publish_month
    updatedMeta.published_year = newYear
    updatedMeta.published_month = newMonth

    await productService.updateProducts(product_id, {
      metadata: updatedMeta,
    })

    logger.info(
      `[EnsurePublishedDates] Product ${product_id}: published_year=${newYear}, published_month=${newMonth}`,
    )

    return new StepResponse({
      changed: true,
      published_year: newYear,
      published_month: newMonth,
    })
  },
)

export const ensureProductPublishedDatesWorkflow = createWorkflow(
  "ensure-product-published-dates",
  (input: EnsureProductPublishedDatesInput) => {
    const result = ensurePublishedDatesStep(input)
    return new WorkflowResponse(result)
  },
)
