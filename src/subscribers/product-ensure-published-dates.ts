import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ensureProductPublishedDatesWorkflow } from "../workflows/ensure-product-published-dates"

export default async function productEnsurePublishedDatesHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  await ensureProductPublishedDatesWorkflow(container).run({
    input: { product_id: data.id },
  })
}

export const config: SubscriberConfig = {
  event: "product.created",
}
