import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const customerId = req.auth_context.actor_id
  const query = req.scope.resolve("query")
  const logger = req.scope.resolve("logger")

  const { data: orders, metadata } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "display_id",
      "status",
      "payment_status",
      "total",
      "subtotal",
      "tax_total",
      "shipping_total",
      "discount_total",
      "currency_code",
      "email",
      "created_at",
      "updated_at",
      "items.*",
      "shipping_address.*",
      "billing_address.*",
    ],
    filters: {
      customer_id: customerId,
    },
  })

  logger.info(`Orders retrieved for customer: ${customerId}, count: ${orders.length}`)

  return res.json({
    orders,
    count: metadata?.count ?? orders.length,
  })
}
