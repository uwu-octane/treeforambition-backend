import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"

const log = (entry: Record<string, unknown>) => {
  console.log(JSON.stringify({ ts: new Date().toISOString(), ...entry }))
}

export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const t0 = Date.now()
  const customerId = req.auth_context.actor_id
  const { id } = req.params
  const query = req.scope.resolve("query")
  const logger = req.scope.resolve("logger")

  log({ level: "info", module: "backend-store-orders", operation: "getOrder", phase: "start", customerId, orderId: id })

  try {
    const { data: orders } = await query.graph({
      entity: "order",
      fields: [
        "id",
        "display_id",
        "status",
        "payment_status",
        "fulfillment_status",
        "customer_id",
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
        customer_id: customerId,
      },
    })

    if (!orders || orders.length === 0) {
      log({ level: "warn", module: "backend-store-orders", operation: "getOrder", phase: "error", duration: Date.now() - t0, customerId, orderId: id })
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
      log({ level: "warn", module: "backend-store-orders", operation: "getOrder", phase: "error", duration: Date.now() - t0, customerId, orderId: id, owner: order.customer_id })
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        "Order not found"
      )
    }

    log({ level: "info", module: "backend-store-orders", operation: "getOrder", phase: "response", duration: Date.now() - t0, customerId, orderId: id })

    return res.json({ order })
  } catch (error) {
    console.error(JSON.stringify({
      ts: new Date().toISOString(),
      module: "backend-store-orders",
      operation: "getOrder",
      phase: "error",
      duration: Date.now() - t0,
      customerId,
      orderId: id,
      message: error instanceof Error ? error.message : String(error),
    }))
    throw error;
  }
}
