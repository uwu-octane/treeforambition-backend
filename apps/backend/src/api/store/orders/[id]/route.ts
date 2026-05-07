import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"

export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const customerId = req.auth_context.actor_id
  const { id } = req.params
  const query = req.scope.resolve("query")
  const logger = req.scope.resolve("logger")

  const { data: orders } = await query.graph({
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
      "items.variant.*",
      "items.product.*",
      "shipping_address.*",
      "billing_address.*",
      "shipping_methods.*",
      "payments.*",
      "fulfillments.*",
    ],
    filters: {
      id,
    },
  })

  if (!orders || orders.length === 0) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "Order not found"
    )
  }

  const order = orders[0]

  // Access control: only the order's customer can view
  if (order.customer_id !== customerId) {
    logger.warn(
      `Unauthorized order access attempt: customer=${customerId}, order=${id}, owner=${order.customer_id}`
    )
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "Order not found"
    )
  }

  return res.json({ order })
}
